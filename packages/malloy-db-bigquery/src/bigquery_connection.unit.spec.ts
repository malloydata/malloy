/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BigQueryOptions} from '@google-cloud/bigquery';
import {MalloyConfig} from '@malloydata/malloy';
import type {TableSourceDef} from '@malloydata/malloy';
import {BigQueryConnection} from './bigquery_connection';
// Registers the 'bigquery' connection type for the MalloyConfig tests.
import './index';

// The callback overload yields (err, rows, nextQuery, apiResponse).
type Cb = (
  err: unknown,
  rows: unknown,
  nextQuery: unknown,
  apiResponse: unknown
) => void;
type Step = (cb: Cb) => void;

const stillRunning: Step = cb =>
  cb(new Error('The query did not complete before 120000ms'), null, null, {
    jobComplete: false,
  });
const complete =
  (rows: unknown[] = [{n: 1}]): Step =>
  cb =>
    cb(null, rows, null, {jobComplete: true, totalRows: String(rows.length)});

// A BigQueryConnection with its BigQuery SDK and timeout config stubbed, so
// runSQL drives the real createBigQueryJob -> getQueryResultsUntilComplete seam
// (deadline wiring, and that a jobComplete:false response never surfaces as
// data) without a live warehouse.
function hermeticConnection(steps: Step[], timeoutMs?: string) {
  const conn = new BigQueryConnection('hermetic');
  let i = 0;
  const getQueryResults = jest.fn((_options: unknown, cb: Cb) => {
    const step = steps[Math.min(i, steps.length - 1)];
    i++;
    step(cb);
  });
  const job = {getQueryResults, cancel: jest.fn()};
  const createQueryJob = jest.fn(async (_options: unknown) => [job]);
  (conn as unknown as {bigQuery: unknown}).bigQuery = {createQueryJob};
  (conn as unknown as {config: {timeoutMs?: string}}).config = {timeoutMs};
  return {conn, getQueryResults, createQueryJob};
}

describe('BigQueryConnection.runSQL (hermetic, stubbed job)', () => {
  it('treats config.timeoutMs "0" as unset: uses the default jobTimeoutMs', async () => {
    // 0 falls back to the default (like blank or non-numeric); it means neither
    // "wait 0ms" nor "wait forever". (Poll-through is covered separately, so
    // this stays a single completed poll to avoid the real inter-poll wait.)
    const {conn, createQueryJob} = hermeticConnection(
      [complete([{n: 5}])],
      '0'
    );
    const data = await conn.runSQL('SELECT 1');
    expect(data.rows).toEqual([{n: 5}]);
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({
      jobTimeoutMs: 600000,
    });
  });

  it('passes a positive timeoutMs through to the job as jobTimeoutMs', async () => {
    const {conn, createQueryJob} = hermeticConnection(
      [complete([{n: 7}])],
      '300000'
    );
    await conn.runSQL('SELECT 1');
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({
      jobTimeoutMs: 300000,
    });
  });

  it('treats a whitespace-only timeoutMs as the default', async () => {
    // Number('   ') is 0, so a naive parse could go wrong here; it must fall
    // back to the default (TIMEOUT_MS, 600000ms) like any other blank value.
    const {conn, createQueryJob} = hermeticConnection(
      [complete([{n: 1}])],
      '   '
    );
    await conn.runSQL('SELECT 1');
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({
      jobTimeoutMs: 600000,
    });
  });

  it('treats a negative timeoutMs as the default', async () => {
    // Number('-5') is -5, which is truthy, so a bare `|| TIMEOUT_MS` would let
    // it through as jobTimeoutMs: -5 and blow the deadline on the first poll.
    // A non-positive value must fall back to the default.
    const {conn, createQueryJob} = hermeticConnection(
      [complete([{n: 1}])],
      '-5'
    );
    await conn.runSQL('SELECT 1');
    expect(createQueryJob.mock.calls[0][0]).toMatchObject({
      jobTimeoutMs: 600000,
    });
  });

  it('polls a still-running response rather than returning it as empty data', async () => {
    const {conn, getQueryResults} = hermeticConnection([
      stillRunning,
      complete([{n: 1}, {n: 2}]),
    ]);
    const data = await conn.runSQL('SELECT 1');
    expect(data.rows).toEqual([{n: 1}, {n: 2}]);
    expect(data.totalRows).toBe(2);
    expect(getQueryResults).toHaveBeenCalledTimes(2);
  });
});

describe('BigQueryConnection authClient', () => {
  // A stand-in for a google-auth AuthClient. Nothing in Malloy inspects one —
  // that is what `opaque` means — so the double only has to be identifiable.
  const authClient = {
    getAccessToken: async () => ({token: 'from-the-host'}),
  } as unknown as BigQueryOptions['authClient'];

  it('hands a host-supplied auth client to the SDK', async () => {
    // The SDK wraps what it is given in a GoogleAuth rather than keeping it as
    // a field, so the claim worth pinning is behavioral: the auth this
    // connection will actually query with is the host's client, not ambient
    // credentials. `getClient()` returns the supplied one without any IO.
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'test-project',
      authClient,
    });
    const sdk = (
      conn as unknown as {
        bigQuery: {authClient: {getClient: () => Promise<unknown>}};
      }
    ).bigQuery;
    await expect(sdk.authClient.getClient()).resolves.toBe(authClient);
  });

  it('separates the digests of two identities on one project', () => {
    // Same project, same SQL, different impersonated service accounts. If the
    // digests matched, the BuildIDs would match, and one tenant would be
    // served rows persisted for the other.
    const forTenant = (tenant: string) =>
      new BigQueryConnection({
        name: 'bq',
        projectId: 'shared-project',
        authClient,
        rawConfigData: {is: 'bigquery', authClient: {tenantAuth: tenant}},
      }).getDigest();

    expect(forTenant('acme')).not.toBe(forTenant('globex'));
    expect(forTenant('acme')).toBe(forTenant('acme'));
  });

  it('leaves the digest alone when no auth client is named', () => {
    // Connections that don't use one keep the digests they have today, so
    // their persisted tables survive this change.
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'shared-project',
    });
    expect(conn.getDigest()).toBe(
      new BigQueryConnection({
        name: 'bq',
        projectId: 'shared-project',
        rawConfigData: {is: 'bigquery'},
      }).getDigest()
    );
  });
});

describe('BigQueryConnection dbmeta', () => {
  it('keeps the digest, so persisted tables are not rebuilt', () => {
    const digest = (dbmeta: boolean) =>
      new BigQueryConnection({
        name: 'bq',
        projectId: 'proj',
        dbmeta,
      }).getDigest();
    expect(digest(true)).toBe(digest(false));
  });

  // The table's metadata call stubbed: one described table, one described
  // column. The schema fetch itself is real.
  async function schemaOf(conn: BigQueryConnection): Promise<TableSourceDef> {
    jest.spyOn(conn, 'getTableFieldSchema').mockResolvedValue({
      schema: {fields: [{name: 'id', type: 'INTEGER', description: 'Id.'}]},
      description: 'Orders.',
      needsTableSuffixPseudoColumn: false,
      needsPartitionTimePseudoColumn: false,
      needsPartitionDatePseudoColumn: false,
    });
    const def = await conn.fetchTableSchema('orders', 'proj.ds.orders');
    if (typeof def === 'string') throw new Error(def);
    return def;
  }

  const notes = (def: TableSourceDef) => [
    ...(def.annotations?.notes ?? []).map(n => n.text),
    ...def.fields.flatMap(f => (f.annotations?.notes ?? []).map(n => n.text)),
  ];

  const DESCRIBED = [
    '#(dbmeta) description="Orders."\n',
    '#(dbmeta) description="Id."\n',
  ];

  it('describes the table and its columns when dbmeta is true', async () => {
    const conn = new BigQueryConnection({
      name: 'bq',
      projectId: 'proj',
      dbmeta: true,
    });
    expect(notes(await schemaOf(conn))).toEqual(DESCRIBED);
  });

  it.each([false, undefined, 'false', 'true', 1])(
    'describes nothing when dbmeta is %p',
    async dbmeta => {
      const conn = new BigQueryConnection({
        name: 'bq',
        projectId: 'proj',
        dbmeta: dbmeta as boolean,
      });
      expect(notes(await schemaOf(conn))).toEqual([]);
    }
  );

  describe('set through an {env: ...} reference', () => {
    const ENV = 'TEST_BIGQUERY_DBMETA';

    afterEach(() => {
      delete process.env[ENV];
    });

    async function connect(value: string) {
      process.env[ENV] = value;
      const config = new MalloyConfig({
        connections: {
          bq: {is: 'bigquery', projectId: 'proj', dbmeta: {env: ENV}},
        },
      });
      const conn = await config.connections.lookupConnection('bq');
      expect(conn).toBeInstanceOf(BigQueryConnection);
      return {conn: conn as BigQueryConnection, log: config.log};
    }

    it.each(['true', 'TRUE', ' true\n'])('turns it on for %p', async value => {
      const {conn, log} = await connect(value);
      expect(notes(await schemaOf(conn))).toEqual(DESCRIBED);
      expect(log).toEqual([]);
    });

    it.each(['false', 'False', ' false\n'])(
      'leaves it off for %p',
      async value => {
        const {conn, log} = await connect(value);
        expect(notes(await schemaOf(conn))).toEqual([]);
        expect(log).toEqual([]);
      }
    );

    it.each(['0', 'no', ''])(
      'leaves it off for %p, with a warning',
      async value => {
        const {conn, log} = await connect(value);
        expect(notes(await schemaOf(conn))).toEqual([]);
        expect(log.map(m => m.message)).toEqual([
          'connections.bq.dbmeta: {"env":"TEST_BIGQUERY_DBMETA"} should resolve to "true" or "false" (expected boolean)',
        ]);
      }
    );
  });
});
