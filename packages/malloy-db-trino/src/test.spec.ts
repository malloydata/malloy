import {Trino, BasicAuth} from 'trino-client';
import PrestoClient from '@prestodb/presto-js-client';

// function CallPresto(client: Client, query: string ) {
//   return new Promise (resolve => {
//     client.execute({query, data => resolve(response)})
//   });
// }

describe('Trino connection', () => {
  console.log('hello');

  test('says hello1', async () => {
    const trino: Trino = Trino.create({
      server: 'http://localhost:8090',
      catalog: 'bigquery',
      schema: 'malloytest',
      auth: new BasicAuth('test'),
    });
    const limit = 50;
    const result = await trino.query(
      // 'explain SELECT 1 as one'
      'explain SELECT * FROM malloytest.ga_sample limit 2'
    );
    let queryResult = await result.next();
    const columns = queryResult.value.columns;

    const outputRows: unknown[] = [];
    while (queryResult !== null && outputRows.length < limit) {
      const rows = queryResult.value.data ?? [];
      for (const row of rows) {
        if (outputRows.length < limit) {
          outputRows.push(row);
        }
      }
      if (!queryResult.done) {
        queryResult = await result.next();
      } else {
        break;
      }
    }

    const d = outputRows![0]![0];
    console.log(d);

    // console.log(outputRows);
    // console.log(columns);
  });

  test('says hello presto', async () => {
    const client = new PrestoClient({
      catalog: 'bigquery',
      host: 'http://localhost',
      port: 8080,
      schema: 'malloytest',
      timezone: 'America/Costa_Rica',
      user: 'root',
    });

    try {
      const ret = await client.query(
        'explain SELECT totals  FROM malloytest.ga_sample limit 2'
        // 'explain select 1 as one, 2 as two'
      );
      const d = ret.data![0][0];


      // console.log(ret);
      console.log(d);
    } catch (error) {
      console.log(error);
    }
  });
});
