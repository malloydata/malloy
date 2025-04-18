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
    conn = await PublisherConnection.create('bigquery',
      //{
      //connectionUri: 'http://localhost:4000/api/v0/projects/malloy-samples/connections/bigquery',
      //}
      {
        connectionUri: 'http://demo.data.pathways.localhost:8000/api/v0/projects/malloy-samples/connections/bigquery',
        accessToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjNDdUMxcFl0OUZSREh1RE9sajBYQyJ9.eyJnaXZlbl9uYW1lIjoiS3lsZSIsImZhbWlseV9uYW1lIjoiTmVzYml0Iiwibmlja25hbWUiOiJram5lc2JpdCIsIm5hbWUiOiJLeWxlIE5lc2JpdCIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJZTgxd2xmc01rMUVFRHJNdXkzRHVZNWFfSVROaWVKWDQ0em5YdTZpUFN6Mi1jTFlVPXM5Ni1jIiwidXBkYXRlZF9hdCI6IjIwMjUtMDQtMTdUMjE6NTE6NTEuOTgzWiIsImVtYWlsIjoia2puZXNiaXRAbXMyLmNvIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImlzcyI6Imh0dHBzOi8vZGV2LW9oYWFmb2d3NXA4dXl4MW0udXMuYXV0aDAuY29tLyIsImF1ZCI6InJyNm16Sk5qOWIxMDRNakNjOXhXS1BQZWhxMU1KeDBMIiwic3ViIjoiZ29vZ2xlLW9hdXRoMnwxMTgwNzczNjkyNTA5MDcwOTc1NDYiLCJpYXQiOjE3NDQ5NDA1MDcsImV4cCI6MTc0NDk3NjUwN30.St0XSYEXCVvNc8Hj4_ZeEfx9ln3h19GVq3TXQWCEU6oXxI-ZswmxMaXtiPPr37tt9vQLbcb6e6GZCHkefRtCS4EX0Rdb5BpR7VqYRcm3xzmvNVNuQRzd0dI1ZPYfoSiHAIgk-u8WAvOAZJkIyy6Qoe3IgzMOsxMlPUY2AFgwLXkkqHQh1S5DzzASF3fDZPIHRjhABEf8xTB3JLSwYOScbrcyzLsRNYZYVIefbL1Hq5FlXKKBvunaN5OhXFif7IV-0lxR55xVCeJo5n84Q_a3mycjWctDswFxur6EAs9BoCWVkFsJx7tusT3dmffHuf4ONQHL6_lvw1IIi8MNNHdajw",
      }
    );
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
