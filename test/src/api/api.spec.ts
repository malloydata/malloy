/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase, coreDatabase, testFileSpace} from '../test_database';
import type {ManagedConnectionLookup} from '@malloydata/malloy';
import {
  MalloyConfig,
  Runtime,
  SingleConnectionRuntime,
  createConnectionsFromConfig,
} from '@malloydata/malloy';
import type {DuckDBConnection} from '@malloydata/db-duckdb';
import type {TagDict, Tag} from '@malloydata/malloy-tag';
import {parseTag, interfaceFromDict} from '@malloydata/malloy-tag';
import '@malloydata/db-duckdb/native';

afterAll(() => testDatabase.shutdown());

describe('basic', () => {
  test('can get query by name from explore', async () => {
    const model = testDatabase.runtime.loadModel(`
      source: s1 is db.table('malloytest.aircraft') extend {
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
    const model = testDatabase.runtime.loadModel(`
      query: q1 is db.table('malloytest.aircraft')->{
        where: state = 'CA'
        group_by: state
      }
    `);
    const q1 = model.loadQueryByName('q1');
    const oneState = await q1.run();
    expect(oneState.data.path(0, 'state').value).toBe('CA');

    const extended = model.extendModel(`
      query: q2 is db.table('malloytest.aircraft')->{
        where: state = 'NV'
        group_by: state
      }
    `);
    const q2 = extended.loadQueryByName('q2');
    const twoState = await q2.run();
    expect(twoState.data.path(0, 'state').value).toBe('NV');
  });
  test('can reference query from previous section ', async () => {
    const model = testDatabase.runtime.loadModel(`
      query: q1 is db.table('malloytest.aircraft')->{
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
    await expect(
      testDatabase.runtime.getQueryByName('', 'Dummy Query')
    ).rejects.toThrow('Given query name does not refer to a named query.');
  });
  test('extending models keep annotations', async () => {
    await testDatabase.runtime
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
      await expect(
        testDatabase.runtime.getModel('source: foo is bar')
      ).rejects.toThrow("Reference to undefined object 'bar'");
    });

    it('throws when false', async () => {
      await expect(
        testDatabase.runtime.getModel('source: foo is bar', {
          noThrowOnError: false,
        })
      ).rejects.toThrow("Reference to undefined object 'bar'");
    });

    it('does not throw when true', async () => {
      const model = await testDatabase.runtime.getModel('source: foo is bar', {
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

describe('default row limit', () => {
  test('default row limit gets added to query', async () => {
    const query = testDatabase.runtime.loadQuery(
      "run: db.table('malloytest.aircraft') -> { group_by: state }"
    );
    const result = await query.run({defaultRowLimit: 1});
    expect(result.data.rowCount).toBe(1);
  });

  test('default row limit does not get added to raw query', async () => {
    const query = testDatabase.runtime.loadQuery(
      `
        run: db.sql("""
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
    const query = testDatabase.runtime.loadQuery(
      "run: db.table('malloytest.aircraft') -> { group_by: state; limit: 2 }"
    );
    const result = await query.run({defaultRowLimit: 1});
    expect(result.data.rowCount).toBe(2);
  });

  test('no default row limit does not add row limit', async () => {
    const query = testDatabase.runtime.loadQuery(
      "run: db.table('malloytest.aircraft') -> { group_by: state }"
    );
    const result = await query.run();
    expect(result.data.rowCount).toBe(10); // Weird that there are only 10 states in this table?
  });
});

const tstDatabase = coreDatabase();
let tstConnection: DuckDBConnection;
beforeAll(async () => {
  tstConnection = await tstDatabase.connection();
});

// All persist tests require the experimental.persistence compiler flag
const PERSIST_ANNOTATION = '##! experimental.persistence';

// Common model fragments
const FLIGHTS_SOURCE = "source: flights is db.table('malloytest.flights')";

afterAll(() => tstDatabase.shutdown());

describe('source persistence', () => {
  describe('per-call buildManifest on ModelMaterializer.loadQuery', () => {
    const MODEL = `${PERSIST_ANNOTATION}
      ${FLIGHTS_SOURCE}

      #@ persist
      source: by_carrier is flights -> {
        group_by: carrier
        aggregate: flight_count is count()
      }
    `;

    function plainRuntime() {
      return new SingleConnectionRuntime({
        connection: tstConnection,
        urlReader: testFileSpace,
      });
    }

    it('applies defaultRowLimit passed to the call', async () => {
      // buildManifest is not special: nothing in CompileQueryOptions
      // survives this call.
      const sql = await plainRuntime()
        .loadModel(MODEL)
        .loadQuery('run: flights -> { select: carrier }', {
          defaultRowLimit: 7,
        })
        .getSQL();
      expect(sql).toContain('LIMIT 7');
    });
  });
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      tagsAre(t: TagDict): R;
    }
  }
}

expect.extend({
  tagsAre(src: string | Tag, result: Tag) {
    if (typeof src === 'string') {
      const {tag, log} = parseTag(src);
      const errs = log.map(e => e.message);
      if (log.length > 0) {
        return {
          pass: false,
          message: () => `${src}: Tag Parsing Error(s)\n${errs.join('\n')}`,
        };
      }
      src = tag;
    }
    const got = src.properties ? interfaceFromDict(src.properties) : undefined;
    if (this.equals(got, result)) {
      return {
        pass: true,
        message: () => 'Parse returned expected object',
      };
    }
    const expected = this.utils.printExpected(result);
    const received = this.utils.printReceived(got);
    return {
      pass: false,
      message: () => `Expected: ${expected}\nReceived: ${received}`,
    };
  },
});
describe('tags in results', () => {
  test('inline compiles get distinct, method-labeled model ids', async () => {
    const src = 'source: one is db.sql("select 1")';
    const m1 = await testDatabase.runtime.loadModel(src).getModel();
    const m2 = await testDatabase.runtime.loadModel(src).getModel();
    const extended = await testDatabase.runtime
      .loadModel(src)
      .extendModel('## x=1')
      .getModel();

    // A URL-less compile is labeled by the operation that made it.
    expect(m1._modelDef.modelID).toMatch(/^internal:\/\/loadModel\//);
    expect(extended._modelDef.modelID).toMatch(/^internal:\/\/extendModel\//);

    // Two inline compiles of identical text are still distinct models — they
    // must not collide on identity (the bug a shared constant URL caused).
    expect(m1._modelDef.modelID).not.toEqual(m2._modelDef.modelID);
  });
});

const tstDB = testDatabase.connectionName;

describe('ManagedConnectionLookup', () => {
  it('createConnectionsFromConfig returns ManagedConnectionLookup with close()', () => {
    const lookup: ManagedConnectionLookup = createConnectionsFromConfig({
      connections: {[tstDB]: {is: 'duckdb'}},
    });
    expect(typeof lookup.lookupConnection).toBe('function');
    expect(typeof lookup.close).toBe('function');
  });

  it('onConnectionCreated callback fires on first lookup', async () => {
    const created: string[] = [];
    const lookup = createConnectionsFromConfig(
      {connections: {[tstDB]: {is: 'duckdb'}}},
      (name, _conn) => created.push(name)
    );
    await lookup.lookupConnection(tstDB);
    expect(created).toEqual([tstDB]);

    // Second lookup should NOT fire callback (connection is cached)
    await lookup.lookupConnection(tstDB);
    expect(created).toEqual([tstDB]);
  });
});

describe('MalloyConfig connections lifecycle', () => {
  it('connections getter returns same object on repeated access', () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {[tstDB]: {is: 'duckdb'}}})
    );
    const a = config.connections;
    const b = config.connections;
    expect(a).toBe(b);
  });

  it('wrapConnections replaces the connections lookup', () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {[tstDB]: {is: 'duckdb'}}})
    );
    const override = {
      lookupConnection: () => testDatabase.connection(),
    };
    config.wrapConnections(() => override);
    expect(config.connections).toBe(override);
  });

  it('runtime.releaseConnections() shuts down managed connections', async () => {
    const config = new MalloyConfig(
      JSON.stringify({connections: {[tstDB]: {is: 'duckdb'}}})
    );
    const runtime = new Runtime({config});
    await runtime.connections.lookupConnection(tstDB);
    await runtime.releaseConnections();
  });
});
