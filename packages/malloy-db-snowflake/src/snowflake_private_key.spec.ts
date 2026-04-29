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

  it('does not flag PKCS#8 encrypted keys (BEGIN ENCRYPTED PRIVATE KEY)', () => {
    // The PKCS#8-encrypted format does NOT use the Proc-Type header;
    // make sure we let it through (snowflake-sdk accepts it directly).
    const pkcs8Encrypted =
      '-----BEGIN ENCRYPTED PRIVATE KEY-----\n' +
      'MIIFHzBJBgkqhkiG9w0BBQ0wPDAbBgkqhkiG9w0BBQwwDgQI\n' +
      '-----END ENCRYPTED PRIVATE KEY-----\n';
    const result = normalizeSnowflakePrivateKey(pkcs8Encrypted);
    expect(result).toContain('-----BEGIN ENCRYPTED PRIVATE KEY-----');
    expect(result.endsWith('\n')).toBe(true);
  });
});
