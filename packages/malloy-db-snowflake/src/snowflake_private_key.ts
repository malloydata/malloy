/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {createPrivateKey} from 'crypto';

const PEM_PATTERNS = [
  {
    beginRegex: /-----BEGIN\s+ENCRYPTED\s+PRIVATE\s+KEY-----/i,
    endRegex: /-----END\s+ENCRYPTED\s+PRIVATE\s+KEY-----/i,
    beginMarker: '-----BEGIN ENCRYPTED PRIVATE KEY-----',
    endMarker: '-----END ENCRYPTED PRIVATE KEY-----',
  },
  {
    beginRegex: /-----BEGIN\s+PRIVATE\s+KEY-----/i,
    endRegex: /-----END\s+PRIVATE\s+KEY-----/i,
    beginMarker: '-----BEGIN PRIVATE KEY-----',
    endMarker: '-----END PRIVATE KEY-----',
  },
  {
    beginRegex: /-----BEGIN\s+RSA\s+PRIVATE\s+KEY-----/i,
    endRegex: /-----END\s+RSA\s+PRIVATE\s+KEY-----/i,
    beginMarker: '-----BEGIN RSA PRIVATE KEY-----',
    endMarker: '-----END RSA PRIVATE KEY-----',
  },
];

/**
 * Normalize a Snowflake private key so snowflake-sdk accepts it.
 *
 * snowflake-sdk's in-memory `ConnectionOptions.privateKey` path only
 * accepts unencrypted PKCS#8 ("BEGIN PRIVATE KEY"). Anything else gets
 * rejected with `Invalid private key. The specified value must be a string
 * in pem format of type pkcs8`. This helper massages the common variants
 * customers paste into config so they reach the SDK in that exact shape:
 *
 *   1. Flattened single-line PEM (no newlines) → re-wrap to 64-char lines.
 *   2. PKCS#1 ("BEGIN RSA PRIVATE KEY") → convert to PKCS#8.
 *   3. Encrypted PKCS#8 ("BEGIN ENCRYPTED PRIVATE KEY") → decrypt with
 *      the supplied passphrase and re-export as unencrypted PKCS#8.
 *   4. Legacy OpenSSL-encrypted PKCS#1 ("Proc-Type: 4,ENCRYPTED") →
 *      rejected with guidance, since modern toolchains don't produce it.
 */
export function normalizeSnowflakePrivateKey(
  privateKey: string,
  passphrase?: string
): string {
  let content = privateKey.trim();

  // Reject legacy OpenSSL-encrypted PKCS#1 keys ("BEGIN RSA PRIVATE KEY"
  // with a "Proc-Type: 4,ENCRYPTED" header). Detected before any newline
  // reconstruction because flattening a single-line key would erase the
  // header and turn this into a confusing downstream parse error.
  if (/Proc-Type\s*:\s*4\s*,\s*ENCRYPTED/i.test(content)) {
    throw new Error(
      'Snowflake private key uses the legacy OpenSSL PKCS#1 encrypted ' +
        'format (Proc-Type: 4,ENCRYPTED), which is not supported. This ' +
        'format is produced by older OpenSSL toolchains. Re-export the ' +
        'key as PKCS#8 with:\n' +
        '    openssl pkcs8 -topk8 -in old.pem -out new.pem\n' +
        'and supply the new key (and its passphrase, if any) to Snowflake.'
    );
  }

  if (!content.includes('\n')) {
    for (const pattern of PEM_PATTERNS) {
      const beginMatch = content.match(pattern.beginRegex);
      const endMatch = content.match(pattern.endRegex);
      if (beginMatch && endMatch) {
        const beginPos = beginMatch.index! + beginMatch[0].length;
        const endPos = endMatch.index!;
        const keyData = content.substring(beginPos, endPos).replace(/\s+/g, '');

        const lines: string[] = [];
        for (let i = 0; i < keyData.length; i += 64) {
          lines.push(keyData.slice(i, i + 64));
        }
        content = `${pattern.beginMarker}\n${lines.join('\n')}\n${pattern.endMarker}\n`;
        break;
      }
    }
  } else if (!content.endsWith('\n')) {
    content += '\n';
  }

  const isEncryptedPkcs8 = /-----BEGIN\s+ENCRYPTED\s+PRIVATE\s+KEY-----/i.test(
    content
  );
  const isPkcs1 = /-----BEGIN\s+RSA\s+PRIVATE\s+KEY-----/i.test(content);

  if (isEncryptedPkcs8) {
    if (!passphrase) {
      throw new Error(
        'Snowflake private key is encrypted (BEGIN ENCRYPTED PRIVATE KEY) ' +
          'but no privateKeyPass was supplied. snowflake-sdk requires an ' +
          'unencrypted key on the in-memory privateKey path; provide the ' +
          'key passphrase via privateKeyPass, or re-export the key without ' +
          'a passphrase.'
      );
    }
    try {
      content = createPrivateKey({key: content, format: 'pem', passphrase})
        .export({type: 'pkcs8', format: 'pem'})
        .toString();
    } catch (err) {
      throw new Error(
        'Failed to decrypt Snowflake encrypted PKCS#8 private key — check ' +
          `that privateKeyPass is correct: ${
            err instanceof Error ? err.message : String(err)
          }`
      );
    }
    if (!content.endsWith('\n')) {
      content += '\n';
    }
  } else if (isPkcs1) {
    try {
      content = createPrivateKey({key: content, format: 'pem'})
        .export({type: 'pkcs8', format: 'pem'})
        .toString();
    } catch (err) {
      throw new Error(
        `Failed to convert Snowflake RSA private key (PKCS#1) to PKCS#8: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    if (!content.endsWith('\n')) {
      content += '\n';
    }
  }

  return content;
}
