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

  beforeAll(async () => {
    conn = await PublisherConnection.create('bigquery', {
      connectionUri: 'http://localhost:4001/projects/home',
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

  afterAll(async () => {
    await conn.close();
  });

  it('runs a SQL query', async () => {
    const res = await conn.runSQL('SELECT 1 as T');
    expect(res.rows[0]['T']).toBe(1);
  });

  it('runs a Malloy query', async () => {
    const sql = await runtime
      .loadModel("source: stories is bigquery.table('bigquery-public-data.hacker_news.full')")
      .loadQuery('run:  stories -> { aggregate: cnt is count() }')
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.totalRows).toBe(55);
    let total = 0;
    for (const row of res.rows) {
      total += +(row['cnt'] ?? 0);
    }
    expect(total).toBe(3540);

    // if we request for a smaller rowLimit we should get fewer rows
    const res_limited = await conn.runSQL(sql, { rowLimit: 10 });
    expect(res_limited.totalRows).toBe(10);
  });

  it('runs a Malloy query on an sql source', async () => {
    const sql = await runtime
      .loadModel(
        "source: aircraft is bigquery.sql('SELECT * FROM bigquery-public-data.hacker_news.full')"
      )
      .loadQuery('run:  aircraft -> { aggregate: cnt is count() }')
      .getSQL();
    const res = await conn.runSQL(sql);
    expect(res.rows.length).toBe(1);
    expect(res.rows[0]['cnt']).toBe(3599);
  }); 1
});
