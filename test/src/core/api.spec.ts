/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';

const runtime = runtimeFor('duckdb');

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  'duckdb'
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
  describe.skip = describe;
}

describe('basic', () => {
  test('can get query by name from explore', async () => {
    const model = runtime.loadModel(`
      source: s1 is duckdb.table('malloytest.aircraft') extend {
        view: v is {
          where: state = 'CA'
          group_by: state
        }
      }
    `);
    const q1 = model.loadExploreByName('s1');
    const oneState = await q1.loadQueryByName('v').run();
    expect(oneState.data.path(0, 'state').value).toBe('CA');
  });
});

describe('extendModel', () => {
  test('can run query in extend section', async () => {
    const model = runtime.loadModel(`
      query: q1 is duckdb.table('malloytest.aircraft')->{
        where: state = 'CA'
        group_by: state
      }
    `);
    const q1 = model.loadQueryByName('q1');
    const oneState = await q1.run();
    expect(oneState.data.path(0, 'state').value).toBe('CA');

    const extended = model.extendModel(`
      query: q2 is duckdb.table('malloytest.aircraft')->{
        where: state = 'NV'
        group_by: state
      }
    `);
    const q2 = extended.loadQueryByName('q2');
    const twoState = await q2.run();
    expect(twoState.data.path(0, 'state').value).toBe('NV');
  });
  test('can reference query from previous section ', async () => {
    const model = runtime.loadModel(`
      query: q1 is duckdb.table('malloytest.aircraft')->{
        where: state = 'CA'
        group_by: state
      }
    `);
    const q1 = model.loadQueryByName('q1');
    const oneState = await q1.run();
    expect(oneState.data.path(0, 'state').value).toBe('CA');

    const extended = model.extendModel('query: q2 is q1 -> { select: * }');
    const q2 = extended.loadQueryByName('q2');
    const twoState = await q2.run();
    expect(twoState.data.path(0, 'state').value).toBe('CA');
  });
  test('returns helpful error message if named query does not exist', async () => {
    await expect(runtime.getQueryByName('', 'Dummy Query')).rejects.toThrow(
      'Given query name does not refer to a named query.'
    );
  });
  test('extending models keep annotations', async () => {
    await runtime
      .loadModel(
        `
          ##! experimental { compilerTestExperimentParse compilerTestExperimentTranslate }
          ;;[ "x" ]
        `
      )
      .extendModel(';;[ "x" ]')
      .extendModel(';;[ "x" ]')
      .getModel();
  });
  describe('noThrowOnError', () => {
    it('throws when not set', async () => {
      await expect(runtime.getModel('source: foo is bar')).rejects.toThrow(
        "Reference to undefined object 'bar'"
      );
    });

    it('throws when false', async () => {
      await expect(
        runtime.getModel('source: foo is bar', {noThrowOnError: false})
      ).rejects.toThrow("Reference to undefined object 'bar'");
    });

    it('does not throw when true', async () => {
      const model = await runtime.getModel('source: foo is bar', {
        noThrowOnError: true,
      });
      expect(model.problems[0]).toEqual(
        expect.objectContaining({
          'at': {
            'range': {
              'end': {'character': 18, 'line': 0},
              'start': {'character': 15, 'line': 0},
            },
            'url': expect.stringMatching(/^internal:\/\/loadModel\//),
          },
          'message': "Reference to undefined object 'bar'",
          'severity': 'error',
        })
      );
    });
  });
});

describe('tags', () => {
  test('view run as query gets tags in explore', async () => {
    const model = runtime.loadModel(`
      source: aircraft is duckdb.table('malloytest.aircraft') extend {
        # bar_chart
        view: by_state is {
          group_by: state
          aggregate: aircraft_count is count()
        }
      }
    `);
    const query = model.loadQuery('run: aircraft -> by_state');
    const result = await query.run();
    expect(result.resultExplore.tagParse().tag.has('bar_chart')).toBe(true);
  });
});

describe('default row limit', () => {
  test('default row limit gets added to query', async () => {
    const query = runtime.loadQuery(
      "run: duckdb.table('malloytest.aircraft') -> { group_by: state }"
    );
    const result = await query.run({defaultRowLimit: 1});
    expect(result.data.rowCount).toBe(1);
  });

  test('default row limit does not get added to raw query', async () => {
    const query = runtime.loadQuery(
      `
        run: duckdb.sql("""
          SELECT 1 as value
          UNION ALL
          SELECT 2 as value
        """)
      `
    );
    const result = await query.run({defaultRowLimit: 1});
    expect(result.data.rowCount).toBe(2);
  });

  test('default row limit does not override existing limit', async () => {
    const query = runtime.loadQuery(
      "run: duckdb.table('malloytest.aircraft') -> { group_by: state; limit: 2 }"
    );
    const result = await query.run({defaultRowLimit: 1});
    expect(result.data.rowCount).toBe(2);
  });

  test('no default row limit does not add row limit', async () => {
    const query = runtime.loadQuery(
      "run: duckdb.table('malloytest.aircraft') -> { group_by: state }"
    );
    const result = await query.run();
    expect(result.data.rowCount).toBe(10); // Weird that there are only 10 states in this table?
  });
});

afterAll(async () => await runtime.connection.close());
