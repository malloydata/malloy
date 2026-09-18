/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {TestTranslator} from '../../lang/test/test-translator';
import '../../lang/test/parse-expects';
import type {
  ModelDef,
  PrepareResultOptions,
  Query,
  QuerySourceDef,
  SQLPhraseSegment,
  SQLSourceDef,
  VirtualMap,
} from '../malloy_types';
import {makeQueryModel} from '../query_model';
import {getSourceRequest} from '../sql_block';
import {
  getCompiledSQL,
  getSourceSQL,
  type CompileQueryCallback,
} from '../sql_compiled';
import {mkBuildID} from '../source_def_utils';

function bindings(table: string): VirtualMap {
  return new Map([['_db_', new Map([['data', table]])]]);
}

function sqlSource(
  selectSegments?: SQLPhraseSegment[],
  selectStr = 'SELECT 1 AS x'
): SQLSourceDef {
  return {
    type: 'sql_select',
    name: 'sql_source',
    connection: '_db_',
    dialect: 'duckdb',
    fields: [{name: 'x', type: 'number'}],
    selectStr,
    selectSegments,
  };
}

describe('SQL block expansion', () => {
  let modelDef: ModelDef;
  let query: Query;
  let source: QuerySourceDef;
  const virtualMap = bindings('translation_data');
  const opts = {virtualMap};
  const compileQuery: CompileQueryCallback = (query, options) =>
    makeQueryModel(modelDef).compileQuery(query, options, false).sql;

  beforeAll(() => {
    const translator = new TestTranslator(`
      ##! experimental.virtual_source
      ##! experimental.persistence
      type: row_fields is { x :: number }
      source: data is _db_.virtual('data')::row_fields
      query: selected is data -> { select: x }
      #@ persist
      source: projected is data -> { select: x }
    `);
    expect(translator).toTranslate();
    modelDef = translator.translate().modelDef!;
    query = translator.getQuery('selected')!;
    const projected = translator.getSourceDef('projected');
    if (projected?.type !== 'query_source') {
      throw new Error('Expected projected to be a query source');
    }
    source = projected;
  });

  test.each(['', 'SELECT 1 /* untouched */\n'])(
    'preserves literal SQL %j without a model',
    sql => {
      const select = [{sql}];
      expect(getSourceRequest(select, '_db_', undefined).selectStr).toBe(sql);
      expect(getCompiledSQL(sqlSource(select), {}, compileQuery)).toBe(sql);
    }
  );

  test.each([undefined, []])(
    'uses the saved SQL when retained segments are %j',
    segments => {
      expect(getCompiledSQL(sqlSource(segments), {}, compileQuery)).toBe(
        'SELECT 1 AS x'
      );
    }
  );

  test.each(['query', 'query source', 'SQL source', 'nested SQL source'])(
    'schema discovery and execution agree for a %s interpolation',
    kind => {
      const interpolations: Record<string, SQLPhraseSegment> = {
        'query': query,
        'query source': source,
        'SQL source': sqlSource(),
        'nested SQL source': sqlSource([{sql: 'SELECT * FROM '}, query]),
      };
      const select = [
        {sql: 'SELECT * FROM '},
        interpolations[kind],
        {sql: ' WHERE x > 0'},
      ];
      const expected = getSourceRequest(
        select,
        '_db_',
        modelDef,
        virtualMap
      ).selectStr;
      expect(expected).toContain('SELECT * FROM (SELECT');
      expect(expected).toContain(' WHERE x > 0');
      expect(getCompiledSQL(sqlSource(select), opts, compileQuery)).toBe(
        expected
      );
    }
  );

  test.each(['', ' \n'])(
    'wraps an interpolation after an existing parenthesis and %j whitespace',
    whitespace => {
      const select = [
        {sql: `SELECT * FROM (${whitespace}`},
        sqlSource(),
        {sql: ')'},
      ];
      const translation = getSourceRequest(select, '_db_', modelDef).selectStr;
      const execution = getCompiledSQL(sqlSource(select), {}, compileQuery);
      const expected = `SELECT * FROM (${whitespace}(SELECT 1 AS x))`;
      expect(translation).toBe(expected);
      expect(execution).toBe(expected);
    }
  );

  test('expands multiple interpolations and nested SQL sources', () => {
    const nested = sqlSource([{sql: 'SELECT * FROM ('}, query, {sql: ')'}]);
    const select = [
      {sql: 'SELECT * FROM '},
      nested,
      {sql: ' UNION ALL SELECT * FROM '},
      source,
    ];
    const expected = getCompiledSQL(sqlSource(select), opts, compileQuery);
    expect(expected).toContain(' UNION ALL SELECT * FROM ');
    expect(expected.match(/translation_data/g)).toHaveLength(2);
    expect(
      getSourceRequest(select, '_db_', modelDef, virtualMap).selectStr
    ).toBe(expected);
  });

  test('rebinds nested SQL sources instead of using their saved SQL', () => {
    const nested = sqlSource([{sql: 'SELECT * FROM '}, query]);
    const select = [{sql: 'SELECT * FROM '}, nested];
    const executionOptions = {virtualMap: bindings('execution_data')};
    const sql = getCompiledSQL(
      sqlSource(select),
      executionOptions,
      compileQuery
    );
    expect(sql).toContain('execution_data');
    expect(sql).not.toContain('translation_data');
    expect(
      getSourceRequest(select, '_db_', modelDef, virtualMap).selectStr
    ).toContain('translation_data');
  });

  test.each(['query source', 'SQL source'])(
    'substitutes a persisted %s from the manifest',
    kind => {
      const persisted =
        kind === 'query source'
          ? source
          : {
              ...sqlSource([{sql: 'SELECT * FROM ('}, query, {sql: ')'}]),
              persistent: true,
            };
      const buildSQL = getSourceSQL(persisted, compileQuery, opts);
      const buildId = mkBuildID('connection-digest', buildSQL);
      const executionOptions: PrepareResultOptions = {
        ...opts,
        connectionDigests: {_db_: 'connection-digest'},
        buildManifest: {
          entries: {[buildId]: {tableName: 'built_data'}},
          strict: true,
        },
      };
      const select = [{sql: 'SELECT * FROM '}, persisted];
      const sql = getCompiledSQL(
        sqlSource(select),
        executionOptions,
        compileQuery
      );
      expect(sql).toBe('SELECT * FROM (SELECT * FROM built_data)');
      expect(
        getSourceRequest(select, '_db_', modelDef, virtualMap).selectStr
      ).toContain('translation_data');
    }
  );

  test('preserves strict manifest failure instead of expanding inline', () => {
    const select = [{sql: 'SELECT * FROM '}, source];
    const executionOptions: PrepareResultOptions = {
      ...opts,
      connectionDigests: {_db_: 'connection-digest'},
      buildManifest: {entries: {}, strict: true},
    };
    expect(() =>
      getCompiledSQL(sqlSource(select), executionOptions, compileQuery)
    ).toThrow(/strict manifest mode forbids fallback/);
  });

  test.each([
    {kind: 'missing', virtualMap: undefined, error: /No virtual-map entry/},
    {
      kind: 'invalid',
      virtualMap: bindings('data; SELECT 1'),
      error: /not a canonical table path/,
    },
  ])(
    'schema discovery and execution reject the $kind binding',
    ({virtualMap, error}) => {
      const select = [{sql: 'SELECT * FROM '}, query];
      expect(() =>
        getSourceRequest(select, '_db_', modelDef, virtualMap)
      ).toThrow(error);
      expect(() =>
        getCompiledSQL(sqlSource(select), {virtualMap}, compileQuery)
      ).toThrow(error);
    }
  );
});
