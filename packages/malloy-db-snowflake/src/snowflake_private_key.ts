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
 * Two transformations:
 *   1. If the PEM was flattened to a single line (e.g. pasted from JSON),
 *      reinsert newlines so it parses.
 *   2. snowflake-sdk requires PKCS#8 ("BEGIN PRIVATE KEY"). If the input is
 *      PKCS#1 ("BEGIN RSA PRIVATE KEY"), convert it.
 */
export function normalizeSnowflakePrivateKey(privateKey: string): string {
  let content = privateKey.trim();

  // Reject legacy OpenSSL-encrypted PKCS#1 keys ("BEGIN RSA PRIVATE KEY"
  // with a "Proc-Type: 4,ENCRYPTED" header). Modern toolchains produce
  // PKCS#8-encrypted keys ("BEGIN ENCRYPTED PRIVATE KEY") which we accept
  // and pass through to snowflake-sdk. We detect this before any newline
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

  if (/-----BEGIN\s+RSA\s+PRIVATE\s+KEY-----/i.test(content)) {
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
