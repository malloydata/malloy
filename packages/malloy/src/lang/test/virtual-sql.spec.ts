/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SQLSourceDef, VirtualMap} from '../../model/malloy_types';
import {QueryModel} from '../../model';
import {sqlKey} from '../../model/sql_block';
import {makeModelFunc} from './test-translator';
import type {TestTranslator} from './test-translator';
import './parse-expects';

const virtualSource = `
  type: row_fields is { x :: number }
  source: data is _db_.virtual('data')::row_fields
`;
const sqlSource = `
  source: wrapped is _db_.sql("""
    SELECT x + 10 AS y FROM %{ data -> { select: x } }
  """)
`;
const compilerFlags = ['experimental.virtual_source'];

function virtualMap(table: string): VirtualMap {
  return new Map([['_db_', new Map([['data', table]])]]);
}

const translationMap = virtualMap('translation_data');
const executionMap = virtualMap('execution_data');
const virtualModel = makeModelFunc({
  virtualMap: translationMap,
  compilerFlags,
  prefix: virtualSource,
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toRequestSQLSchema(table?: string): R;
      toRebindVirtualSource(): R;
    }
  }
}

expect.extend({
  toRequestSQLSchema(translator: TestTranslator, table = 'translation_data') {
    const request = translator.translate().compileSQL;
    const expected = {
      connection: '_db_',
      selectStr: expect.stringContaining(table),
    };
    return {
      pass: this.equals(request, expected),
      message: () =>
        this.utils.matcherHint('toRequestSQLSchema', 'translator', 'table', {
          isNot: this.isNot,
        }) +
        `\n\nExpected request: ${this.utils.printExpected(expected)}` +
        `\nReceived request: ${this.utils.printReceived(request)}` +
        `\n${translator.prettyErrors()}`,
    };
  },
  toRebindVirtualSource(translator: TestTranslator) {
    const modelDef = translator.translate().modelDef!;
    const queryModel = new QueryModel(modelDef);
    const query = modelDef.queryList[modelDef.queryList.length - 1];
    const {sql} = queryModel.compileQuery(query, {virtualMap: executionMap});
    let missingMapError: unknown;
    try {
      queryModel.compileQuery(query);
    } catch (error) {
      missingMapError = error;
    }
    return {
      pass:
        sql.includes('execution_data') &&
        !sql.includes('translation_data') &&
        missingMapError instanceof Error &&
        /No virtual-map entry/.test(missingMapError.message),
      message: () =>
        this.utils.matcherHint('toRebindVirtualSource', 'translator', '', {
          isNot: this.isNot,
        }) +
        '\n\nExpected SQL to use execution_data without translation_data,' +
        ' and compilation without a virtual map to reject the missing binding.' +
        `\nReceived SQL:\n${sql}` +
        '\nCompilation without a virtual map: ' +
        (missingMapError === undefined
          ? 'succeeded'
          : this.utils.printReceived(missingMapError)),
    };
  },
});

// Schema fixtures describe the SQL output; retain the requested SQL for rebinding.
function answerSchema(
  translator: TestTranslator,
  fields: SQLSourceDef['fields']
): void {
  const {connection, selectStr} = translator.translate().compileSQL!;
  const key = sqlKey(connection, selectStr);
  translator.update({
    compileSQL: {
      [key]: {
        type: 'sql_select',
        name: key,
        dialect: 'duckdb',
        connection,
        selectStr,
        fields,
      },
    },
  });
}

describe('virtual sources in SQL blocks', () => {
  test('an interpolated query uses the translation map and can be rebound', () => {
    const m = virtualModel`
      source: wrapped is _db_.sql("""
        SELECT x + 10 AS y FROM %{ data -> { select: x } }
      """)
      run: wrapped -> { select: y }
    `;
    expect(m.translator).toRequestSQLSchema();
    answerSchema(m.translator, [{name: 'y', type: 'number'}]);
    expect(m).toTranslate();
    expect(m.translator).toRebindVirtualSource();
  });

  test.each(['source', 'query'])(
    'resolves virtual sources through a named %s',
    kind => {
      const m = virtualModel`
        ${kind}: indirect is data -> { select: x }
        run: _db_.sql("""SELECT x + 10 AS y FROM %{ indirect }""") -> {
          select: y
        }
      `;
      expect(m.translator).toRequestSQLSchema();
      answerSchema(m.translator, [{name: 'y', type: 'number'}]);
      expect(m).toTranslate();
      expect(m.translator).toRebindVirtualSource();
    }
  );

  test('nested SQL sources use the map for both schema requests', () => {
    const m = virtualModel`
      source: inner_sql is _db_.sql("""
        SELECT x FROM %{ data -> { select: x } }
      """)
      run: _db_.sql("""SELECT x + 10 AS y FROM %{ inner_sql }""") -> {
        select: y
      }
    `;
    expect(m.translator).toRequestSQLSchema();
    answerSchema(m.translator, [{name: 'x', type: 'number'}]);
    expect(m.translator).toRequestSQLSchema();
    answerSchema(m.translator, [{name: 'y', type: 'number'}]);
    expect(m).toTranslate();
    expect(m.translator).toRebindVirtualSource();
  });

  test('resolves a virtual source reached through a join', () => {
    const m = virtualModel`
      source: base is a extend {
        join_one: joined is data on true
      }
      source: indirect is base -> { select: x is joined.x }
      run: _db_.sql("""SELECT x + 10 AS y FROM %{ indirect }""") -> {
        select: y
      }
    `;
    expect(m.translator).toRequestSQLSchema();
    answerSchema(m.translator, [{name: 'y', type: 'number'}]);
    expect(m).toTranslate();
    expect(m.translator).toRebindVirtualSource();
  });

  test('SQL blocks in imports share the root translation map', () => {
    const m = makeModelFunc({virtualMap: translationMap, compilerFlags})`
      import 'definitions.malloy'
      run: wrapped -> { select: y }
    `;
    m.translator.importZone.define(
      'internal://test/langtests/definitions.malloy',
      `##! experimental.virtual_source\n${virtualSource}${sqlSource}`
    );
    expect(m.translator).toRequestSQLSchema();
    answerSchema(m.translator, [{name: 'y', type: 'number'}]);
    expect(m).toTranslate();
    expect(m.translator).toRebindVirtualSource();
  });

  test('interpolating an existing SQL source uses the new translation map', () => {
    const original = virtualModel`${sqlSource}`;
    expect(original.translator).toRequestSQLSchema();
    answerSchema(original.translator, [{name: 'y', type: 'number'}]);
    expect(original).toTranslate();

    const extended = makeModelFunc({
      internalModel: original.translator.translate().modelDef!,
      virtualMap: virtualMap('replacement_data'),
      compilerFlags,
    })`
      run: _db_.sql("""SELECT * FROM %{ wrapped }""") -> { select: y }
    `;
    const request = extended.translator.translate().compileSQL;
    expect(request?.selectStr).not.toContain('translation_data');
    expect(extended.translator).toRequestSQLSchema('replacement_data');
    answerSchema(extended.translator, [{name: 'y', type: 'number'}]);
    expect(extended).toTranslate();
    expect(extended.translator).toRebindVirtualSource();
  });

  test.each<{kind: string; map?: VirtualMap}>([
    {kind: 'absent'},
    {kind: 'empty', map: new Map()},
    {
      kind: 'missing the virtual name',
      map: new Map([['_db_', new Map([['other', 'unused']])]]),
    },
  ])('a map that is $kind cannot supply a SQL schema request', ({map}) => {
    const m = makeModelFunc({compilerFlags, virtualMap: map})`
        ${virtualSource}
        ${sqlSource}
      `;
    expect(() => m.translator.translate()).toThrow(/No virtual-map entry/);
  });

  test('virtual sources outside SQL blocks need no translation map', () => {
    const m = makeModelFunc({compilerFlags})`
      ${virtualSource}
      run: data -> { select: x }
    `;
    expect(m).toTranslate();
    expect(m.translator).toRebindVirtualSource();
  });
});

describe('virtual-map table paths at SQL substitution', () => {
  test.each([
    'data; SELECT 1',
    'data -- comment',
    '(SELECT 1 AS x)',
    '',
    'data/file.parquet',
  ])('rejects the used path %j before requesting a SQL schema', tablePath => {
    const m = makeModelFunc({
      compilerFlags,
      prefix: virtualSource,
      virtualMap: virtualMap(tablePath),
    })`${sqlSource}`;
    expect(() => m.translator.translate()).toThrow(
      `virtualMap entry '_db_.data' has table path ${JSON.stringify(tablePath)}, ` +
        'which is not a canonical table path for duckdb:'
    );
  });

  test('checks execution bindings independently of the translation map', () => {
    const m = virtualModel`
      ${sqlSource}
      run: wrapped -> { select: y }
    `;
    expect(m.translator).toRequestSQLSchema();
    answerSchema(m.translator, [{name: 'y', type: 'number'}]);
    expect(m).toTranslate();
    const modelDef = m.translator.translate().modelDef!;
    expect(() =>
      new QueryModel(modelDef).compileQuery(modelDef.queryList[0], {
        virtualMap: virtualMap('data; SELECT 1'),
      })
    ).toThrow(/virtualMap entry '_db_\.data'.*duckdb/);
  });

  // Each path is valid in one dialect and invalid in the other. Acceptance
  // by some registered dialect must not authorize substitution into this SQL.
  test.each([
    {connection: '_bq_', table: '`some_table`', accepted: true},
    {connection: '_db_', table: '`some_table`', accepted: false},
    {connection: '_db_', table: "'data.parquet'", accepted: true},
    {connection: '_pg_', table: "'data.parquet'", accepted: false},
  ])(
    '$connection checks $table in its own dialect',
    ({connection, table, accepted}) => {
      const m = makeModelFunc({compilerFlags})`
        type: row_fields is { x :: number }
        source: data is ${connection}.virtual('data')::row_fields
        run: data -> { select: x }
      `;
      expect(m).toTranslate();
      const modelDef = m.translator.translate().modelDef!;
      const compile = () =>
        new QueryModel(modelDef).compileQuery(modelDef.queryList[0], {
          virtualMap: new Map([[connection, new Map([['data', table]])]]),
        });
      if (accepted) {
        expect(compile().sql).toContain(table);
      } else {
        expect(compile).toThrow(/virtualMap entry.*not a canonical table path/);
      }
    }
  );
});
