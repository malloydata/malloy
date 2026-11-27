/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import type {VirtualMap} from '@malloydata/malloy';
import {
  Runtime,
  SingleConnectionRuntime,
  MalloyConfig,
  FixedConnectionMap,
  InMemoryURLReader,
  Malloy,
} from '@malloydata/malloy';
import '@malloydata/db-duckdb/native';
import {DuckDBConnection} from '@malloydata/db-duckdb';

const tstDB = testDatabase.connectionName;
const VIRTUAL_ANNOTATION = '##! experimental.virtual_source';

afterAll(() => testDatabase.shutdown());

function mkVirtualMap(
  entries: Record<string, Record<string, string>>
): VirtualMap {
  const map = new Map<string, Map<string, string>>();
  for (const [conn, inner] of Object.entries(entries)) {
    map.set(conn, new Map(Object.entries(inner)));
  }
  return map;
}

describe('virtual source resolution', () => {
  it('virtual source resolves to real table', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is {
        carrier :: string,
        flight_count :: number
      }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {vflights: 'malloytest.flights'},
    });

    const result = await testDatabase.runtime.loadQuery(code).run({virtualMap});
    expect(result.data.value.length).toBe(5);
  });

  it('virtual source with dimensions and measures', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is {
        carrier :: string,
        dep_time :: timestamp
      }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields extend {
        dimension: carrier_upper is upper(carrier)
        measure: flight_count is count()
      }
      run: flights -> {
        group_by: carrier_upper
        aggregate: flight_count
        limit: 5
      }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {vflights: 'malloytest.flights'},
    });

    const result = await testDatabase.runtime.loadQuery(code).run({virtualMap});
    expect(result.data.value.length).toBe(5);
    const row = result.data.value[0];
    expect(row['carrier_upper']).toBeDefined();
    expect(row['flight_count']).toBeDefined();
  });

  it('missing virtualMap entry throws', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: s is { x :: string }
      source: v is ${tstDB}.virtual('no_such_table')::s
      run: v -> { select: x; limit: 1 }
    `;

    await expect(testDatabase.runtime.loadQuery(code).run()).rejects.toThrow(
      /No virtual-map entry for virtual source 'no_such_table'/
    );
  });

  it('per-query virtualMap overrides runtime virtualMap', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: carrier_fields is { code :: string, nickname :: string }
      source: carriers is ${tstDB}.virtual('vcarriers')::carrier_fields
      run: carriers -> { select: code; limit: 5 }
    `;

    const runtimeMap = mkVirtualMap({
      [tstDB]: {vcarriers: 'malloytest.nonexistent_table'},
    });

    const queryMap = mkVirtualMap({
      [tstDB]: {vcarriers: 'malloytest.carriers'},
    });

    const runtime = new SingleConnectionRuntime({
      connection: await testDatabase.connection(),
    });
    runtime.virtualMap = runtimeMap;

    // Query-level map should win over runtime-level map
    const result = await runtime.loadQuery(code).run({virtualMap: queryMap});
    expect(result.data.value.length).toBe(5);
  });

  it('join between virtual sources', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: model_fields is {
        aircraft_model_code :: string,
        manufacturer :: string,
        seats :: number
      }
      type: aircraft_fields is {
        tail_num :: string,
        aircraft_model_code :: string
      }
      source: vmodels is ${tstDB}.virtual('vmodels')::model_fields extend {
        primary_key: aircraft_model_code
        measure: model_count is count()
      }
      source: vaircraft is ${tstDB}.virtual('vaircraft')::aircraft_fields extend {
        primary_key: tail_num
        join_one: vmodels with aircraft_model_code
        measure: aircraft_count is count()
      }
      run: vaircraft -> {
        aggregate:
          aircraft_count
          vmodels.model_count
      }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {
        vmodels: 'malloytest.aircraft_models',
        vaircraft: 'malloytest.aircraft',
      },
    });

    const result = await testDatabase.runtime.loadQuery(code).run({virtualMap});
    const row = result.data.value[0];
    expect(row['aircraft_count']).toBeDefined();
    expect(row['model_count']).toBeDefined();
  });

  it('join to derived virtual source (extend)', async () => {
    // A virtual source carries its `virtualMap` key in `name`. Joining a
    // source rebinds it to the join name; that rebinding must go through `as`
    // and leave `name` intact, otherwise the key ("vcarriers") is replaced by
    // the join name ("carriers") and resolution fails with
    // "No virtual-map entry for 'carriers'".
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      type: carrier_fields is { code :: string, nickname :: string }

      source: flights_raw is ${tstDB}.virtual('vflights')::flight_fields
      source: carriers_raw is ${tstDB}.virtual('vcarriers')::carrier_fields

      source: carriers is carriers_raw extend {
        primary_key: code
      }
      source: flights is flights_raw extend {
        join_one: carriers with carrier
      }

      run: flights -> {
        group_by: carriers.nickname
        aggregate: flight_count is count()
      }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {
        vflights: 'malloytest.flights',
        vcarriers: 'malloytest.carriers',
      },
    });

    const result = await testDatabase.runtime.loadQuery(code).run({virtualMap});
    expect(result.data.value.length).toBeGreaterThan(0);
  });

  it('virtualMap from MalloyConfig is available', () => {
    const configJSON = JSON.stringify({
      connections: {
        duckdb: {is: 'duckdb'},
      },
      virtualMap: {
        duckdb: {
          flights: 'malloytest.flights',
          carriers: 'malloytest.carriers',
        },
      },
    });

    const config = new MalloyConfig(configJSON);
    const virtualMap = config.virtualMap;
    expect(virtualMap).toBeDefined();
    expect(virtualMap!.get('duckdb')?.get('flights')).toBe(
      'malloytest.flights'
    );
    expect(virtualMap!.get('duckdb')?.get('carriers')).toBe(
      'malloytest.carriers'
    );
  });

  it('config-driven Runtime gets virtualMap from config', () => {
    const configJSON = JSON.stringify({
      connections: {
        [tstDB]: {is: 'duckdb'},
      },
      virtualMap: {
        [tstDB]: {vflights: 'malloytest.flights'},
      },
    });

    const config = new MalloyConfig(configJSON);
    const runtime = new Runtime({config});
    expect(runtime.virtualMap?.get(tstDB)?.get('vflights')).toBe(
      'malloytest.flights'
    );
  });

  it('config-driven Runtime resolves virtual sources', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const configJSON = JSON.stringify({
      connections: {
        [tstDB]: {is: 'duckdb'},
      },
      virtualMap: {
        [tstDB]: {vflights: 'malloytest.flights'},
      },
    });

    // Use config for virtualMap, but app-driven connection for test database access
    const config = new MalloyConfig(configJSON);
    const runtime = new SingleConnectionRuntime({
      connection: await testDatabase.connection(),
    });
    runtime.virtualMap = config.virtualMap;

    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });

  it('virtualMap set via setter is used', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const virtualMap = mkVirtualMap({
      [tstDB]: {vflights: 'malloytest.flights'},
    });

    const runtime = new SingleConnectionRuntime({
      connection: await testDatabase.connection(),
    });
    runtime.virtualMap = virtualMap;

    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });
});

describe('Runtime with config + connections override', () => {
  it('config provides virtualMap while connections override provides connection', async () => {
    const code = `${VIRTUAL_ANNOTATION}
      type: flight_fields is { carrier :: string }
      source: flights is ${tstDB}.virtual('vflights')::flight_fields
      run: flights -> { select: carrier; limit: 5 }
    `;

    const configJSON = JSON.stringify({
      connections: {[tstDB]: {is: 'duckdb'}},
      virtualMap: {[tstDB]: {vflights: 'malloytest.flights'}},
    });

    const config = new MalloyConfig(configJSON);
    // Pass config for virtualMap, but override connections with test connection
    const runtime = new Runtime({
      config,
      connections: {
        lookupConnection: () => testDatabase.connection(),
      },
    });

    expect(runtime.virtualMap?.get(tstDB)?.get('vflights')).toBe(
      'malloytest.flights'
    );
    const result = await runtime.loadQuery(code).run();
    expect(result.data.value.length).toBe(5);
  });
});

const virtualSource = `
  ##! experimental.virtual_source
  type: row_fields is { x :: number }
  source: data is duckdb.virtual('data')::row_fields
`;
const sqlSource = `
  source: wrapped is duckdb.sql("""
    SELECT x + 10 AS y FROM %{ data -> { select: x } }
  """)
  run: wrapped -> { select: y }
`;
const source = virtualSource + sqlSource;

function virtualMap(table: string): VirtualMap {
  return new Map([['duckdb', new Map([['data', table]])]]);
}

// Language cases live in packages/malloy/src/lang/test/virtual-sql.spec.ts.
// These tests cover API option forwarding and real SQL schemas.
describe('virtual sources in SQL blocks through the Foundation API', () => {
  const connection = new DuckDBConnection({
    name: 'duckdb',
    databasePath: ':memory:',
  });
  const connections = FixedConnectionMap.fromArray([connection]);
  const compileMap = virtualMap('translation_data');
  const executionMap = virtualMap('execution_data');
  const urlReader = new InMemoryURLReader(new Map());

  beforeAll(async () => {
    await connection.runSQL(
      'CREATE TEMP TABLE translation_data AS SELECT 1::INTEGER AS x'
    );
    await connection.runSQL(
      'CREATE TEMP TABLE execution_data AS SELECT 2::INTEGER AS x'
    );
  });

  afterAll(async () => {
    await connection.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('Malloy.compile uses a translation map without binding execution', async () => {
    const model = await Malloy.compile({
      source,
      connections,
      urlReader,
      virtualMap: compileMap,
    });
    const result = model.preparedQuery.getPreparedResult({
      virtualMap: executionMap,
    });
    expect(result.sql).toContain('execution_data');
    expect(result.sql).not.toContain('translation_data');
    expect((await connection.runSQL(result.sql)).rows).toEqual([{y: 12}]);
    expect(() => model.preparedQuery.getPreparedResult()).toThrow(
      /No virtual-map entry/
    );
  });

  test('loadModel forwards its map and execution can override it', async () => {
    const runtime = new Runtime({connections});
    runtime.virtualMap = virtualMap('missing_runtime_table');
    const result = await runtime
      .loadModel(source, {virtualMap: compileMap})
      .loadFinalQuery()
      .run({virtualMap: executionMap});
    expect(result.data.value).toEqual([{y: 12}]);
  });

  test('runtime config supplies the translation map', async () => {
    const config = new MalloyConfig({
      virtualMap: {duckdb: {data: 'translation_data'}},
    });
    const runtime = new Runtime({connections, config});
    const result = await runtime.loadQuery(source).run();
    expect(result.data.value).toEqual([{y: 11}]);
  });

  test('model.loadQuery uses an explicit translation map', async () => {
    const runtime = new Runtime({connections});
    runtime.virtualMap = virtualMap('missing_runtime_table');
    const result = await runtime
      .loadModel(virtualSource)
      .loadQuery(sqlSource, {virtualMap: compileMap})
      .run({virtualMap: executionMap});
    expect(result.data.value).toEqual([{y: 12}]);
  });

  test('model.loadQuery falls back to the runtime translation map', async () => {
    const runtime = new Runtime({connections});
    runtime.virtualMap = compileMap;
    const result = await runtime
      .loadModel(virtualSource)
      .loadQuery(sqlSource)
      .run({virtualMap: executionMap});
    expect(result.data.value).toEqual([{y: 12}]);
  });

  test('model.loadQuery inherits the model translation map', async () => {
    const runtime = new Runtime({connections});
    runtime.virtualMap = virtualMap('missing_runtime_table');
    const result = await runtime
      .loadModel(virtualSource, {virtualMap: compileMap})
      .loadQuery(sqlSource)
      .run({virtualMap: executionMap});
    expect(result.data.value).toEqual([{y: 12}]);
  });

  test('an empty translation map overrides the runtime map', async () => {
    const runtime = new Runtime({connections});
    runtime.virtualMap = compileMap;
    await expect(
      runtime.loadModel(source, {virtualMap: new Map()}).getModel()
    ).rejects.toThrow(/No virtual-map entry/);
  });

  test('an invalid translation binding fails before SQL schema discovery', async () => {
    const fetchSchema = jest
      .spyOn(connection, 'fetchSchemaForSQLStruct')
      .mockRejectedValue(new Error('Unexpected SQL schema request'));
    await expect(
      Malloy.compile({
        source,
        connections,
        urlReader,
        virtualMap: virtualMap('translation_data; SELECT 1'),
      })
    ).rejects.toThrow(/virtualMap entry 'duckdb.data'.*duckdb/);
    expect(fetchSchema).not.toHaveBeenCalled();
  });

  test('an invalid execution binding fails before query execution', async () => {
    const runtime = new Runtime({connections});
    const query = runtime.loadQuery(source, {virtualMap: compileMap});
    await query.getPreparedQuery();
    const runSQL = jest
      .spyOn(connection, 'runSQL')
      .mockRejectedValue(new Error('Unexpected query execution'));
    await expect(
      query.run({virtualMap: virtualMap('execution_data; SELECT 1')})
    ).rejects.toThrow(/virtualMap entry 'duckdb.data'.*duckdb/);
    expect(runSQL).not.toHaveBeenCalled();
  });

  test.each(['explicit', 'inherited', 'runtime'])(
    'extendModel uses its %s translation map',
    async binding => {
      const runtime = new Runtime({connections});
      runtime.virtualMap =
        binding === 'runtime' ? compileMap : virtualMap('missing_table');
      const model = runtime.loadModel(virtualSource, {
        virtualMap:
          binding === 'inherited'
            ? compileMap
            : binding === 'explicit'
              ? virtualMap('missing_inherited_table')
              : undefined,
      });
      const extended = model.extendModel(
        sqlSource,
        binding === 'explicit' ? {virtualMap: compileMap} : undefined
      );
      const result = await extended.loadFinalQuery().run();
      expect(result.data.value).toEqual([{y: 11}]);
    }
  );

  test('Malloy.compile forwards its map to a pre-parsed translator', async () => {
    const parse = Malloy.parse({source});
    const model = await Malloy.compile({
      parse,
      connections,
      urlReader,
      virtualMap: compileMap,
    });
    const result = model.preparedQuery.getPreparedResult({
      virtualMap: executionMap,
    });
    expect((await connection.runSQL(result.sql)).rows).toEqual([{y: 12}]);
  });

  test.each(['compile', 'run'])(
    '%s ignores an invalid override binding when it is unused',
    async operation => {
      const badMap = virtualMap('translation_data');
      badMap.get('duckdb')!.set('unused', 'translation_data; SELECT 1');
      const runtime = new Runtime({connections});
      const result =
        operation === 'compile'
          ? Malloy.compile({source, connections, urlReader, virtualMap: badMap})
          : runtime
              .loadQuery(source, {virtualMap: compileMap})
              .run({virtualMap: badMap});
      await expect(result).resolves.toBeDefined();
    }
  );

  test.each(['config', 'assignment'])(
    'bindings from %s are preserved and checked only when used',
    async kind => {
      const badTable = 'translation_data; SELECT 1';
      const config =
        kind === 'config'
          ? new MalloyConfig({
              virtualMap: {
                duckdb: {data: 'translation_data', unused: badTable},
              },
            })
          : undefined;
      const runtime = new Runtime({connections, config});
      if (kind === 'assignment') {
        const map = virtualMap('translation_data');
        map.get('duckdb')!.set('unused', badTable);
        runtime.virtualMap = map;
      }
      expect(runtime.virtualMap?.get('duckdb')?.get('unused')).toBe(badTable);
      expect((await runtime.loadQuery(source).run()).data.value).toEqual([
        {y: 11},
      ]);
      await expect(
        runtime
          .loadQuery(
            `
          ${virtualSource}
          source: bad is duckdb.virtual('unused')::row_fields
          run: bad -> { select: x }
        `
          )
          .getSQL()
      ).rejects.toThrow(/virtualMap entry 'duckdb.unused'.*duckdb/);
    }
  );
});
