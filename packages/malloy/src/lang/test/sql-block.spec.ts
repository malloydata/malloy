/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {TestTranslator, aTableDef} from './test-translator';
import './parse-expects';
import {MalloyTranslator} from '../parse-malloy';
import type {SQLSourceDef} from '../../model';
import {sqlKey} from '../../model/sql_block';
import type {SQLSourceRequest} from '../translate-response';

describe('connection sql()', () => {
  const selStmt = 'SELECT * FROM aTable';
  function makeSchemaResponse(sql: SQLSourceRequest): {
    [key: string]: SQLSourceDef;
  } {
    const cname = sql.connection || 'bigquery';
    const key = sqlKey(cname, sql.selectStr);
    return {
      [key]: {
        type: 'sql_select',
        name: key,
        dialect: 'standardsql',
        connection: cname,
        selectStr: selStmt,
        fields: aTableDef.fields,
      },
    };
  }

  test('source from sql', () => {
    const model = new TestTranslator(`
      source: users is aConnection.sql("""${selStmt}""")
      source: malloyUsers is users extend { primary_key: ai }
    `);
    expect(model).toParse();
    const needReq = model.translate();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    if (needs) {
      model.update({compileSQL: makeSchemaResponse(needs)});
      expect(model).toTranslate();
      const users = model.getSourceDef('malloyUsers');
      expect(users).toBeDefined();
    }
  });

  test('source from imported sql-based-source', () => {
    const createModel = `
      source: malloyUsers is _db_.sql('${selStmt}') extend { primary_key: ai }
    `;
    const model = new TestTranslator(`
      import "createModel.malloy"
      source: importUsers is malloyUsers
      run: malloyUsers -> { select: * }
      run: importUsers -> { select: * }
    `);
    model.importZone.define(
      'internal://test/langtests/createModel.malloy',
      createModel
    );
    expect(model).toParse();
    const needReq = model.translate();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    model.update({compileSQL: makeSchemaResponse(needs!)});
    expect(model).toTranslate();
  });

  it('simple turducken', () => {
    const m = new TestTranslator(`
      source: someSql is _db_.sql("""SELECT * FROM %{ a -> { group_by: astr } } WHERE 1=1""")
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      expect(compileSql.selectStr).toEqual(
        'SELECT * FROM (SELECT \n   base.`astr` as `astr`\nFROM `aTable` as base\nGROUP BY 1\nORDER BY 1 asc\n) WHERE 1=1'
      );
    }
  });
  it('turduckenzilla', () => {
    const m = new TestTranslator(`
      run: duckdb.sql("""
        SELECT * from (%{
          duckdb.sql("""SELECT 2 as two""") extend {
            view: b is {
              nest: c is {
                extend: {
                  join_one: d is duckdb.sql("""
                    SELECT * from (%{
                      duckdb.sql("""SELECT 3 as three""") extend {
                        view: b is {
                          nest: c is {
                            extend: {
                              join_one: d is duckdb.sql("""SELECT 4 as four""") on three = d.four - 1
                            }
                            group_by: three
                          }
                        }
                      } -> { group_by: three }
                    })
                  """) on two = d.three
                }
                group_by: two
              }
            }
          } -> { group_by: two }
        })
      """) -> { group_by: two }
    `);
    expect(m).toParse();
  });
  test('source from extended sql-based-source', () => {
    const model = new TestTranslator(`
      source: sql_block is aConnection.sql("""${selStmt}""")
      source: malloy_source is sql_block extend { primary_key: ai }
    `);
    expect(model).toParse();
    const needReq = model.translate();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    model.update({compileSQL: makeSchemaResponse(needs!)});
    expect(model).toTranslate();
    const modelDef = model?.translate()?.modelDef;

    // this tests the underlying api that .extendModel calls
    const extModel = new MalloyTranslator('sqlblocktest://main');
    extModel.importZone.define(
      'sqlblocktest://main',
      'run: malloy_source -> { select: * }'
    );
    const tr = extModel.translate(modelDef);
    // because extModel is not a TestTranslator we can't use the hotness
    expect(tr.problems).toEqual([]);
    expect(tr.modelDef).toBeDefined();
  });
});
