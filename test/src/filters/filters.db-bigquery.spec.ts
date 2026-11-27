import {testModel} from '../models/faa_model';
import {testDatabase} from '../test_database';
import {bqCompile, compileQuery} from '../bigquery/bigquery_compile';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

describe('BigQuery expression tests', () => {
  const faa = testDatabase.runtime.loadModel(testModel);

  it('filtered_measures', async () => {
    const sql = await compileQuery(
      faa,
      `
      run: flights -> {
        // TODO previously this filter list was just on the QUERY
        // which can't even have a filter list; I assume it's meant that
        // these should be applied to the aggregate...
        where: origin.state = 'CA'
        where: destination.state = 'NY'
        group_by: carriers.name
        aggregate: flight_count
      }
      `
    );
    await bqCompile(sql);
  });
});
