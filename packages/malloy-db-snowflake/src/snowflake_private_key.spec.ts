/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {generateKeyPairSync} from 'crypto';
import {normalizeSnowflakePrivateKey} from './snowflake_private_key';

describe('normalizeSnowflakePrivateKey', () => {
  const {privateKey: pkcs8Pem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
    publicKeyEncoding: {type: 'spki', format: 'pem'},
  });
  const {privateKey: pkcs1Pem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {type: 'pkcs1', format: 'pem'},
    publicKeyEncoding: {type: 'pkcs1', format: 'pem'},
  });

  it('passes a multi-line PKCS#8 key through and adds a trailing newline', () => {
    const trimmed = pkcs8Pem.trimEnd();
    const result = normalizeSnowflakePrivateKey(trimmed);
    expect(result).toContain('-----BEGIN PRIVATE KEY-----');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('converts a multi-line PKCS#1 RSA key to PKCS#8', () => {
    const result = normalizeSnowflakePrivateKey(pkcs1Pem);
    expect(result).toContain('-----BEGIN PRIVATE KEY-----');
    expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('converts a single-line PKCS#1 RSA key to PKCS#8', () => {
    const singleLine = pkcs1Pem.replace(/\n/g, '');
    const result = normalizeSnowflakePrivateKey(singleLine);
    expect(result).toContain('-----BEGIN PRIVATE KEY-----');
    expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
  });

  it('reconstructs a single-line PKCS#8 key without conversion', () => {
    const singleLine = pkcs8Pem.replace(/\n/g, '');
    const result = normalizeSnowflakePrivateKey(singleLine);
    expect(result.startsWith('-----BEGIN PRIVATE KEY-----\n')).toBe(true);
    expect(result.endsWith('-----END PRIVATE KEY-----\n')).toBe(true);
  });

  it('throws a clear error when the RSA PEM is malformed', () => {
    const bogus =
      '-----BEGIN RSA PRIVATE KEY-----\nnotvalidbase64==\n-----END RSA PRIVATE KEY-----\n';
    expect(() => normalizeSnowflakePrivateKey(bogus)).toThrow(/PKCS#1.*PKCS#8/);
  });

  it('rejects multi-line legacy OpenSSL-encrypted PKCS#1 keys', () => {
    const legacyEncrypted =
      '-----BEGIN RSA PRIVATE KEY-----\n' +
      'Proc-Type: 4,ENCRYPTED\n' +
      'DEK-Info: AES-256-CBC,0123456789ABCDEF0123456789ABCDEF\n' +
      '\n' +
      'YmFzZTY0Y2lwaGVydGV4dA==\n' +
      '-----END RSA PRIVATE KEY-----\n';
    expect(() => normalizeSnowflakePrivateKey(legacyEncrypted)).toThrow(
      /Proc-Type: 4,ENCRYPTED/
    );
    expect(() => normalizeSnowflakePrivateKey(legacyEncrypted)).toThrow(
      /openssl pkcs8 -topk8/
    );
  });

  it('rejects single-line legacy OpenSSL-encrypted PKCS#1 keys', () => {
    // Single-line variant — the Proc-Type header still appears as a
    // substring, so detection must work without anchoring to line start.
    const legacyEncryptedFlat =
      '-----BEGIN RSA PRIVATE KEY----- Proc-Type: 4,ENCRYPTED ' +
      'DEK-Info: AES-256-CBC,0123456789ABCDEF0123456789ABCDEF ' +
      'YmFzZTY0Y2lwaGVydGV4dA== -----END RSA PRIVATE KEY-----';
    expect(() => normalizeSnowflakePrivateKey(legacyEncryptedFlat)).toThrow(
      /legacy OpenSSL PKCS#1 encrypted format/
    );
  });

  // snowflake-sdk's in-memory privateKey path only accepts unencrypted
  // PKCS#8 — passing through "BEGIN ENCRYPTED PRIVATE KEY" would be
  // rejected by util.js's BEGIN-PRIVATE-KEY check before auth. So we
  // decrypt to unencrypted PKCS#8 here.
  const encryptedPassphrase = 'test-passphrase';
  const {privateKey: encryptedPkcs8Pem} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: encryptedPassphrase,
    },
    publicKeyEncoding: {type: 'spki', format: 'pem'},
  });

  it('decrypts encrypted PKCS#8 to unencrypted PKCS#8 with valid passphrase', () => {
    expect(encryptedPkcs8Pem).toContain(
      '-----BEGIN ENCRYPTED PRIVATE KEY-----'
    );
    const result = normalizeSnowflakePrivateKey(
      encryptedPkcs8Pem,
      encryptedPassphrase
    );
    expect(result).toContain('-----BEGIN PRIVATE KEY-----');
    expect(result).not.toContain('ENCRYPTED PRIVATE KEY');
    expect(result.endsWith('\n')).toBe(true);
  });

  it('throws when encrypted PKCS#8 has no passphrase', () => {
    expect(() => normalizeSnowflakePrivateKey(encryptedPkcs8Pem)).toThrow(
      /no privateKeyPass was supplied/
    );
  });

  it('throws a clear error when encrypted PKCS#8 passphrase is wrong', () => {
    expect(() =>
      normalizeSnowflakePrivateKey(encryptedPkcs8Pem, 'wrong-passphrase')
    ).toThrow(/Failed to decrypt.*privateKeyPass/);
  });

  it('decrypts a single-line encrypted PKCS#8 key with valid passphrase', () => {
    // Flattened (e.g. pasted from JSON without literal newlines) — the
    // single-line reconstruction path must rewrap before decrypt.
    const singleLine = encryptedPkcs8Pem.replace(/\n/g, '');
    const result = normalizeSnowflakePrivateKey(
      singleLine,
      encryptedPassphrase
    );
    expect(result).toContain('-----BEGIN PRIVATE KEY-----');
    expect(result).not.toContain('ENCRYPTED PRIVATE KEY');
    expect(result.endsWith('\n')).toBe(true);
  });
});
