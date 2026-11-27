import {testModel} from '../models/faa_model';
import {testDatabase} from '../test_database';
import {bqCompile, compileQuery} from '../bigquery/bigquery_compile';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

describe('BigQuery expression tests', () => {
  const faa = testDatabase.runtime.loadModel(testModel);

  it('flights.search_index', async () => {
    const sql = await compileQuery(faa, 'run: flights->search_index');
    await bqCompile(sql);
  });

  it('flights.search_index', async () => {
    const sql = await compileQuery(faa, 'run: flights->search_index');
    await bqCompile(sql);
  });
});
