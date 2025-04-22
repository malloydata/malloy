import * as malloy from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {PublisherConnection} from './publisher_connection';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as fs from 'fs';

const [describe] = describeIfDatabaseAvailable(['publisher']);

describe('db:Publisher', () => {
  let conn: PublisherConnection;
  let runtime: malloy.Runtime;
  let getTableSchema: jest.SpyInstance;
  let getSQLBlockSchema: jest.SpyInstance;

  beforeEach(async () => {
    conn = await PublisherConnection.create('bigquery', {
      connectionUri:
        'http://localhost:4000/api/v0/projects/malloy-samples/connections/bigquery',
      accessToken: 'xyz',
    });

    const files = {
      readURL: async (url: URL) => {
        const filePath = fileURLToPath(url);
        return await util.promisify(fs.readFile)(filePath, 'utf8');
      },
    };

    runtime = new malloy.Runtime({
      urlReader: files,
      connection: conn,
    });

    getTableSchema = jest
      .spyOn(PublisherConnection.prototype as any, 'fetchTableSchema')
      .mockResolvedValue({
        type: 'table',
        dialect: 'standardsql',
        tablePath: 'bigquery-public-data.hacker_news.full',
        fields: [
          {name: 'title', type: 'string'},
          {name: 'by', type: 'string'},
          {name: 'score', type: 'number'},
        ],
      });

    getSQLBlockSchema = jest
      .spyOn(PublisherConnection.prototype as any, 'fetchSelectSchema')
      .mockResolvedValue({
        type: 'sql_select',
        dialect: 'standardsql',
        selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
        fields: [
          {name: 'title', type: 'string'},
          {name: 'by', type: 'string'},
          {name: 'score', type: 'number'},
        ],
      });
  });

  afterEach(async () => {
    await conn.close();
    jest.resetAllMocks();
  });

  it('tests the connection', async () => {
    await conn.test();
  });

  it('correctly identifies the dialect', () => {
    expect(conn.dialectName).toBe('standardsql');
  });

  it('correctly identifies the connection as a pooled connection', () => {
    expect(conn.isPool()).toBe(false);
  });

  it('correctly identifies the connection as a streaming connection', () => {
    expect(conn.canStream()).toBe(true);
  });

  it('correctly identifies the connection as a persistSQLResults connection', () => {
    expect(conn.canPersist()).toBe(true);
  });

  it('caches table schema', async () => {
    await conn.fetchTableSchema(
      'bigquery',
      'bigquery-public-data.hacker_news.full'
    );
    expect(getTableSchema).toBeCalledTimes(1);
    await conn.fetchTableSchema(
      'bigquery',
      'bigquery-public-data.hacker_news.full'
    );
    expect(getTableSchema).toBeCalledTimes(1);
  });

  it('refreshes table schema', async () => {
    await conn.fetchTableSchema(
      'bigquery',
      'bigquery-public-data.hacker_news.full'
    );
    expect(getTableSchema).toBeCalledTimes(1);
    await conn.fetchSchemaForTables(
      {'bigquery': 'bigquery-public-data.hacker_news.full'},
      {refreshTimestamp: Date.now() + 10}
    );
    expect(getTableSchema).toBeCalledTimes(2);
  });

  it('caches sql schema', async () => {
    await conn.fetchSelectSchema({
      connection: 'bigquery',
      selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
    });
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await conn.fetchSelectSchema({
      connection: 'bigquery',
      selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
    });
    expect(getSQLBlockSchema).toBeCalledTimes(1);
  });

  it('refreshes sql schema', async () => {
    await conn.fetchSelectSchema({
      connection: 'bigquery',
      selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
    });
    expect(getSQLBlockSchema).toBeCalledTimes(1);
    await conn.fetchSchemaForSQLStruct(
      {
        connection: 'bigquery',
        selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
      },
      {refreshTimestamp: Date.now() + 10}
    );
    expect(getSQLBlockSchema).toBeCalledTimes(2);
  });

  it('runs a SQL query', async () => {
    const res = await conn.runSQL('SELECT 1 as T');
    expect(res.rows[0]['T']).toBe(1);
  });

  it('runs a Malloy query', async () => {
    const sql = await runtime
      .loadModel(
        "source: stories is bigquery.table('bigquery-public-data.hacker_news.full')"
      )
      .loadQuery(
        'run:  stories -> { aggregate: cnt is count() group_by: `by` order_by: cnt desc limit: 10 }'
      )
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.totalRows).toBe(10);
    let total = 0;
    for (const row of res.rows) {
      total += +(row['cnt'] ?? 0);
    }
    expect(total).toBe(1836679);
  });

  it('runs a Malloy query on an sql source', async () => {
    const sql = await runtime
      .loadModel(
        "source: stories is bigquery.sql('SELECT * FROM bigquery-public-data.hacker_news.full')"
      )
      .loadQuery(
        'run:  stories -> { aggregate: cnt is count() group_by: `by` order_by: cnt desc limit: 20 }'
      )
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.totalRows).toBe(20);
    expect(res.rows[0]['cnt']).toBe(1346912);
  });

  it('get temporary table name', async () => {
    const sql = 'SELECT 1 as T';
    const tempTableName = await conn.manifestTemporaryTable(sql);
    expect(tempTableName).toBeDefined();
    expect(tempTableName.startsWith('lofty-complex-452701')).toBe(true);
  });
});
