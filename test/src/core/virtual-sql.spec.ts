/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DuckDBConnection} from '@malloydata/db-duckdb';
import {
  FixedConnectionMap,
  InMemoryURLReader,
  Malloy,
  MalloyConfig,
  Runtime,
} from '@malloydata/malloy';
import type {VirtualMap} from '@malloydata/malloy';

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
