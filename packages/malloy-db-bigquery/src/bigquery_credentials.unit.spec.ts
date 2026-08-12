/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyConfig, getConnectionProperties} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';
// Registers the 'bigquery' connection type, which the property tests read back.
import './index';

// A realistic key shape: what matters is that `private_key` carries its
// newlines as JSON `\n` escapes, the way every downloaded key file does. A
// server that puts those two lines in an environment variable by hand loses
// them; going through JSON is what turns them back into real newlines, and a
// PEM without real newlines fails to sign.
const KEY = {
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'abc123',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nMIIBVQ==\n-----END PRIVATE KEY-----\n',
  client_email: 'malloy@test-project.iam.gserviceaccount.com',
  client_id: '1234567890',
  token_uri: 'https://oauth2.googleapis.com/token',
};
const KEY_JSON = JSON.stringify(KEY);
const KEY_BASE64 = Buffer.from(KEY_JSON, 'utf8').toString('base64');

/** The connection's private config, which is where credentials come to rest. */
function configOf(conn: BigQueryConnection): {
  credentials?: {client_email?: string; private_key?: string};
  [key: string]: unknown;
} {
  return (conn as unknown as {config: Record<string, unknown>})
    .config as ReturnType<typeof configOf>;
}

describe('BigQueryConnection service account key, supplied as a string', () => {
  it('parses serviceAccountKeyJson into credentials', () => {
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'test-project',
      serviceAccountKeyJson: KEY_JSON,
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });

  it('decodes and parses serviceAccountKeyJsonBase64 into credentials', () => {
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'test-project',
      serviceAccountKeyJsonBase64: KEY_BASE64,
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });

  it("restores the private key's newlines from its JSON escapes", () => {
    // The whole point of routing the key through JSON rather than through two
    // separate client_email/private_key strings: a PEM whose "\n" stayed
    // two literal characters is not a PEM, and the failure surfaces much
    // later, as an opaque signing error.
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: KEY_JSON,
    });
    const key = configOf(conn).credentials?.private_key ?? '';
    expect(key).toContain('\n');
    expect(key).not.toContain('\\n');
    expect(key.split('\n')).toHaveLength(4);
  });

  it('keeps the raw key material out of the retained config', () => {
    // `config` is what the connection holds for the rest of its life and what
    // any config dump would reach. Only the parsed credentials belong there —
    // not the string the key arrived in.
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: KEY_JSON,
      serviceAccountKeyJsonBase64: KEY_BASE64,
    });
    const config = configOf(conn);
    expect(config['serviceAccountKeyJson']).toBeUndefined();
    expect(config['serviceAccountKeyJsonBase64']).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain(KEY_BASE64);
  });

  it('ignores an empty value, as an unset environment variable produces', () => {
    // `{env: "X"}` with X set-but-empty resolves to "", which must not be
    // taken as "the key is here" and blow up as malformed JSON.
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: '',
      serviceAccountKeyJsonBase64: '',
      client_email: 'fallback@test-project.iam.gserviceaccount.com',
      private_key: 'fallback-key',
    });
    expect(configOf(conn).credentials).toEqual({
      client_email: 'fallback@test-project.iam.gserviceaccount.com',
      private_key: 'fallback-key',
    });
  });
});

describe('BigQueryConnection service account key precedence', () => {
  it('prefers the structured serviceAccountKey over the string forms', () => {
    const structured = {
      client_email: 'structured@test.iam.gserviceaccount.com',
    };
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKey: structured,
      serviceAccountKeyJson: KEY_JSON,
      serviceAccountKeyJsonBase64: KEY_BASE64,
    });
    expect(configOf(conn).credentials).toEqual(structured);
  });

  it('prefers serviceAccountKeyJson over the base64 form', () => {
    const other = {...KEY, client_email: 'base64@test.iam.gserviceaccount.com'};
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: KEY_JSON,
      serviceAccountKeyJsonBase64: Buffer.from(
        JSON.stringify(other),
        'utf8'
      ).toString('base64'),
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });

  it('prefers either string form over client_email/private_key', () => {
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJsonBase64: KEY_BASE64,
      client_email: 'loser@test-project.iam.gserviceaccount.com',
      private_key: 'loser-key',
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });
});

describe('BigQueryConnection service account key errors', () => {
  it('rejects malformed JSON by naming the property, not quoting the value', () => {
    // JSON.parse's own SyntaxError quotes the text it choked on. That text is
    // a private key, so it must not reach the message — the property name and
    // what the slot expects are the whole of what a caller needs.
    const secret = '{"private_key": "-----BEGIN PRIVATE KEY-----\nsecret';
    expect(
      () => new BigQueryConnection({name: 'bq', serviceAccountKeyJson: secret})
    ).toThrow(/serviceAccountKeyJson is not a JSON object/);
    try {
      new BigQueryConnection({name: 'bq', serviceAccountKeyJson: secret});
    } catch (error) {
      expect((error as Error).message).not.toContain('secret');
      expect((error as Error).message).not.toContain('BEGIN PRIVATE KEY');
    }
  });

  it('rejects JSON that parses to something other than an object', () => {
    expect(
      () =>
        new BigQueryConnection({
          name: 'bq',
          serviceAccountKeyJson: '"a string"',
        })
    ).toThrow(/serviceAccountKeyJson is not a JSON object/);
    expect(
      () => new BigQueryConnection({name: 'bq', serviceAccountKeyJson: '[]'})
    ).toThrow(/serviceAccountKeyJson is not a JSON object/);
    expect(
      () => new BigQueryConnection({name: 'bq', serviceAccountKeyJson: 'null'})
    ).toThrow(/serviceAccountKeyJson is not a JSON object/);
  });

  it('names base64 when the base64 slot holds unencoded JSON', () => {
    // Buffer's decoder drops characters outside the base64 alphabet instead of
    // failing, so raw JSON here decodes to garbage rather than throwing. The
    // error has to point at the encoding, or the mistake is invisible.
    expect(
      () =>
        new BigQueryConnection({
          name: 'bq',
          serviceAccountKeyJsonBase64: KEY_JSON,
        })
    ).toThrow(/serviceAccountKeyJsonBase64 did not base64-decode/);
  });
});

describe('a key held in an environment variable', () => {
  // The end of the road this change exists to open: a config that names an
  // environment variable, resolved through the real overlay stack, arriving at
  // a connection with usable credentials. Everything above tests a piece of
  // this; this tests that the pieces meet.
  const ENV = 'TEST_BIGQUERY_SERVICE_ACCOUNT_KEY';

  afterEach(() => {
    delete process.env[ENV];
  });

  it('resolves {env: ...} into serviceAccountKeyJson', async () => {
    process.env[ENV] = KEY_JSON;
    const config = new MalloyConfig({
      connections: {
        bq: {
          is: 'bigquery',
          projectId: 'test-project',
          serviceAccountKeyJson: {env: ENV},
        },
      },
    });
    expect(config.log).toEqual([]);
    const conn = await config.connections.lookupConnection('bq');
    expect(configOf(conn as BigQueryConnection).credentials).toEqual(KEY);
  });

  it('resolves {env: ...} into serviceAccountKeyJsonBase64', async () => {
    process.env[ENV] = KEY_BASE64;
    const config = new MalloyConfig({
      connections: {
        bq: {
          is: 'bigquery',
          projectId: 'test-project',
          serviceAccountKeyJsonBase64: {env: ENV},
        },
      },
    });
    expect(config.log).toEqual([]);
    const conn = await config.connections.lookupConnection('bq');
    expect(configOf(conn as BigQueryConnection).credentials).toEqual(KEY);
  });

  it('cannot reach the structured serviceAccountKey slot, as before', async () => {
    // The behavior that makes the two slots above necessary, pinned so it
    // stays a deliberate design and not an accident: a `json` property takes
    // its value literally, so the reference object itself lands in the
    // credentials and the SDK later complains about a missing client_email.
    // If malloy ever resolves references into json slots, this test should
    // fail and be deleted along with half of this file's reason to exist.
    process.env[ENV] = KEY_JSON;
    const config = new MalloyConfig({
      connections: {
        bq: {
          is: 'bigquery',
          projectId: 'test-project',
          serviceAccountKey: {env: ENV},
        },
      },
    });
    const conn = await config.connections.lookupConnection('bq');
    expect(configOf(conn as BigQueryConnection).credentials).toEqual({
      env: ENV,
    });
  });
});

describe('bigquery connection property registration', () => {
  const properties = getConnectionProperties('bigquery') ?? [];
  const byName = (name: string) => properties.find(p => p.name === name);

  it.each(['serviceAccountKeyJson', 'serviceAccountKeyJsonBase64'])(
    '%s is a secret string, so an {env: ...} reference resolves into it',
    name => {
      // Not a cosmetic assertion: the config compiler resolves overlay
      // references only in non-`json` slots. Retyping either of these as
      // 'json' would silently restore the very gap they exist to close, and
      // the failure would show up as an authentication error far from here.
      const property = byName(name);
      expect(property).toBeDefined();
      expect(property?.type).toBe('secret');
      expect(property?.optional).toBe(true);
    }
  );

  it('leaves serviceAccountKey structured', () => {
    expect(byName('serviceAccountKey')?.type).toBe('json');
  });
});
