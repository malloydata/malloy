/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BigQueryOptions} from '@google-cloud/bigquery';
import {MalloyConfig, getConnectionProperties} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';
// Registers the 'bigquery' connection type, which the property tests read back.
import './index';

// A downloaded key file carries the private key's newlines as JSON `\n`
// escapes, so the JSON text itself is a single line. Parsing is what turns
// those escapes back into the real newlines a PEM needs.
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
  serviceAccountKeyJson?: unknown;
} {
  return (conn as unknown as {config: ReturnType<typeof configOf>}).config;
}

describe('BigQueryConnection service account key, supplied as a string', () => {
  it('parses a JSON key into credentials', () => {
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'test-project',
      serviceAccountKeyJson: KEY_JSON,
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });

  it('detects and decodes a base64-encoded key', () => {
    // Same property, no flag: `{` is not in the base64 alphabet, so the two
    // encodings can be told apart with certainty.
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'test-project',
      serviceAccountKeyJson: KEY_BASE64,
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });

  it('tolerates whitespace around either encoding', () => {
    // A here-doc, a copied secret, and `$(cat key.json)` all tend to arrive
    // with a trailing newline.
    for (const value of [`\n${KEY_JSON}\n`, `  ${KEY_BASE64}\n`]) {
      const conn = new BigQueryConnection({
        name: 'bq',
        serviceAccountKeyJson: value,
      });
      expect(configOf(conn).credentials).toEqual(KEY);
    }
  });

  it("restores the private key's newlines from its JSON escapes", () => {
    // A PEM whose "\n" stayed two literal characters is not a PEM, and the
    // failure surfaces much later as an opaque signing error. This is what
    // separates a whole key file from a bare `private_key` string, which an
    // environment variable cannot carry the newlines of.
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: KEY_JSON,
    });
    const key = configOf(conn).credentials?.private_key ?? '';
    expect(key).toContain('\n');
    expect(key).not.toContain('\\n');
    expect(key.split('\n')).toHaveLength(4);
  });

  it('accepts an external account credential, which carries no key', () => {
    // The other shape the SDK's `credentials` option takes (workload identity
    // federation). It has no client_email, so a check written only around
    // service account keys would reject a valid credential.
    const externalAccount = {
      type: 'external_account',
      audience: '//iam.googleapis.com/projects/1/locations/global/x/y',
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      credential_source: {file: '/var/run/secrets/token'},
    };
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: JSON.stringify(externalAccount),
    });
    expect(configOf(conn).credentials).toEqual(externalAccount);
  });

  it('keeps the raw key material out of the retained config', () => {
    // `config` is what the connection holds for the rest of its life and what
    // any config dump would reach. Only the parsed credentials belong there —
    // not the string the key arrived in.
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: KEY_BASE64,
    });
    const config = configOf(conn);
    expect(config.serviceAccountKeyJson).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain(KEY_BASE64);
  });

  it.each([
    ['empty', ''],
    ['whitespace only', ' \n '],
  ])('ignores a set-but-%s value', (_label, serviceAccountKeyJson) => {
    // `{env: "X"}` with X set to "" resolves to "", which must not be taken as
    // "the key is here" and fail as malformed. (X *unset* is a different path
    // entirely: the reference resolves to undefined and the property is
    // dropped before the connection sees it.)
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson,
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
  it('prefers the structured serviceAccountKey over the string form', () => {
    const structured = {
      client_email: 'structured@test.iam.gserviceaccount.com',
    };
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKey: structured,
      serviceAccountKeyJson: KEY_JSON,
    });
    expect(configOf(conn).credentials).toEqual(structured);
  });

  it('prefers the string form over client_email/private_key', () => {
    const conn = new BigQueryConnection({
      name: 'bq',
      serviceAccountKeyJson: KEY_JSON,
      client_email: 'loser@test-project.iam.gserviceaccount.com',
      private_key: 'loser-key',
    });
    expect(configOf(conn).credentials).toEqual(KEY);
  });
});

describe('BigQueryConnection service account key errors', () => {
  const construct = (serviceAccountKeyJson: string) => () =>
    new BigQueryConnection({name: 'bq', serviceAccountKeyJson});

  it('rejects a malformed value without quoting it', () => {
    // JSON.parse's own SyntaxError quotes the text it choked on. That text is
    // a private key, so it must not reach the message — the property name and
    // what the slot expects are the whole of what a caller needs.
    const secret = '{"private_key": "-----BEGIN PRIVATE KEY-----\nsecret';
    expect(construct(secret)).toThrow(
      /serviceAccountKeyJson is neither JSON nor base64-encoded JSON/
    );
    try {
      construct(secret)();
    } catch (error) {
      expect((error as Error).message).not.toContain('secret');
      expect((error as Error).message).not.toContain('BEGIN PRIVATE KEY');
    }
  });

  it('names both encodings, since either could have been intended', () => {
    // Base64 decoding cannot fail — Buffer drops what it doesn't recognize —
    // so by the time the parse fails there is no way to know which encoding
    // was meant. The message has to cover both rather than guess.
    expect(construct('not a key at all')).toThrow(
      /neither JSON nor base64-encoded JSON/
    );
  });

  it('rejects JSON that is not a credential object', () => {
    // The failure this whole property exists to prevent: valid JSON that the
    // SDK would take and then reject at the first query with "does not
    // contain a client_email field".
    for (const value of ['{}', '{"project_id": "p"}', '"a string"', '[]']) {
      expect(construct(value)).toThrow(
        /serviceAccountKeyJson (parsed but is not a service account key|is neither)/
      );
    }
  });

  it('rejects a key missing half its credential pair', () => {
    const half = JSON.stringify({client_email: KEY.client_email});
    expect(construct(half)).toThrow(/is not a service account key/);
    expect(construct(half)).toThrow(/not a fragment of one/);
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

  async function connect(): Promise<BigQueryConnection> {
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
    expect(conn).toBeInstanceOf(BigQueryConnection);
    return conn as BigQueryConnection;
  }

  it('resolves {env: ...} holding JSON', async () => {
    process.env[ENV] = KEY_JSON;
    expect(configOf(await connect()).credentials).toEqual(KEY);
  });

  it('resolves {env: ...} holding base64', async () => {
    process.env[ENV] = KEY_BASE64;
    expect(configOf(await connect()).credentials).toEqual(KEY);
  });

  it('cannot reach the structured serviceAccountKey slot, as before', async () => {
    // The behavior that makes the property above necessary, pinned so it stays
    // a deliberate design and not an accident: a `json` property takes its
    // value literally, so the reference object itself lands in the credentials
    // and the SDK later complains about a missing client_email. If malloy ever
    // resolves references into json slots, this test should fail and be
    // deleted along with half of this file's reason to exist.
    process.env[ENV] = KEY_JSON;
    const config = new MalloyConfig({
      connections: {
        bq: {is: 'bigquery', serviceAccountKey: {env: ENV}},
      },
    });
    const conn = await config.connections.lookupConnection('bq');
    expect(conn).toBeInstanceOf(BigQueryConnection);
    expect(configOf(conn as BigQueryConnection).credentials).toEqual({
      env: ENV,
    });
  });
});

describe('bigquery connection property registration', () => {
  const properties = getConnectionProperties('bigquery') ?? [];
  const byName = (name: string) => properties.find(p => p.name === name);

  it('registers serviceAccountKeyJson as a secret string', () => {
    // Not a cosmetic assertion: the config compiler resolves overlay
    // references only in non-`json` slots. Retyping this as 'json' would
    // silently restore the very gap it exists to close, and the failure would
    // show up as an authentication error far from here.
    const property = byName('serviceAccountKeyJson');
    expect(property).toBeDefined();
    expect(property?.type).toBe('secret');
    expect(property?.optional).toBe(true);
  });

  it('leaves serviceAccountKey structured', () => {
    expect(byName('serviceAccountKey')?.type).toBe('json');
  });

  it('registers no separate base64 property', () => {
    // One property, two encodings, detected. A second property would be a
    // second thing to get wrong in config for no gain.
    expect(byName('serviceAccountKeyJsonBase64')).toBeUndefined();
  });
});

describe('an auth client and a service account key together', () => {
  // A stand-in for a google-auth AuthClient. Nothing in Malloy inspects one.
  const authClient = {
    getAccessToken: async () => ({token: 'from-the-host'}),
  } as unknown as BigQueryOptions['authClient'];

  it.each([
    ['serviceAccountKeyJson', {serviceAccountKeyJson: KEY_JSON}],
    ['serviceAccountKey', {serviceAccountKey: KEY}],
    ['serviceAccountKeyPath', {serviceAccountKeyPath: '/keys/bq.json'}],
    ['client_email/private_key', {client_email: 'a@b.com', private_key: 'k'}],
  ])('is refused when the key came from %s', (_label, credential) => {
    // The SDK caches the auth client and never looks at the key again, so
    // without this the key is dead config that reads as live and the queries
    // run as an identity nobody chose.
    expect(
      () => new BigQueryConnection({name: 'bq', authClient, ...credential})
    ).toThrow(/sets authClient and also/);
  });

  it('is fine with an auth client alone', () => {
    expect(
      () => new BigQueryConnection({name: 'bq', projectId: 'p', authClient})
    ).not.toThrow();
  });
});
