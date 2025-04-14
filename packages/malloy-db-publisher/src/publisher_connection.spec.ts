import * as malloy from '@malloydata/malloy';
import { describeIfDatabaseAvailable } from '@malloydata/malloy/test';
import { PublisherConnection } from './publisher_connection';
import { fileURLToPath } from 'url';
import * as util from 'util';
import * as fs from 'fs';

const [describe] = describeIfDatabaseAvailable(['publisher']);

describe('db:Publisher', () => {
  let conn: PublisherConnection;
  let runtime: malloy.Runtime;

  beforeEach(async () => {
    conn = await PublisherConnection.create('bigquery', {
      connectionUri: 'http://localhost:4000/api/v0/projects/home/connections/bigquery',
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
  });

  afterEach(async () => {
    await conn.close();
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

  it('fetches the table schema', async () => {
    const schema = await conn.fetchTableSchema('bigquery', 'bigquery-public-data.hacker_news.full');
    expect(schema.type).toBe('table');
    expect(schema.dialect).toBe('standardsql');
    expect(schema.tablePath).toBe('bigquery-public-data.hacker_news.full');
    expect(schema.fields.length).toBe(14);
    expect(schema.fields[0].name).toBe('title');
    expect(schema.fields[0].type).toBe('string');
  });

  it('fetches the sql source schema', async () => {
    const schema = await conn.fetchSelectSchema({
      connection: 'bigquery',
      selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
    });
    expect(schema.type).toBe('sql_select');
    expect(schema.dialect).toBe('standardsql');
    expect(schema.fields.length).toBe(14);
    expect(schema.fields[0].name).toBe('title');
    expect(schema.fields[0].type).toBe('string');
  });

  it('runs a SQL query', async () => {
    const res = await conn.runSQL('SELECT 1 as T');
    expect(res.rows[0]['T']).toBe(1);
  });

  it('runs a Malloy query', async () => {
    const sql = await runtime
      .loadModel("source: stories is bigquery.table('bigquery-public-data.hacker_news.full')")
      .loadQuery('run:  stories -> { aggregate: cnt is count() group_by: `by` order_by: cnt desc limit: 10 }')
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
      .loadQuery('run:  stories -> { aggregate: cnt is count() group_by: `by` order_by: cnt desc limit: 20 }')
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
