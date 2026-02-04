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

import {
  TEST_DIALECT,
  TestTranslator,
  aTableDef,
  errorMessage,
  model,
} from './test-translator';
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
        dialect: TEST_DIALECT,
        connection: cname,
        selectStr: selStmt,
        fields: aTableDef.fields,
      },
    };
  }

  function translateWithSchemas(m: TestTranslator): void {
    for (;;) {
      const response = m.translate();
      if (response.compileSQL) {
        m.update({compileSQL: makeSchemaResponse(response.compileSQL)});
      } else {
        break;
      }
    }
  }

  test('source from sql', () => {
    const m = new TestTranslator(`
      source: users is aConnection.sql("""${selStmt}""")
      source: malloyUsers is users extend { primary_key: ai }
    `);
    translateWithSchemas(m);
    expect(m).toTranslate();
    const users = m.getSourceDef('malloyUsers');
    expect(users).toBeDefined();
  });

  test('source from imported sql-based-source', () => {
    const createModel = `
      source: malloyUsers is _db_.sql('${selStmt}') extend { primary_key: ai }
    `;
    const m = new TestTranslator(`
      import "createModel.malloy"
      source: importUsers is malloyUsers
      run: malloyUsers -> { select: * }
      run: importUsers -> { select: * }
    `);
    m.importZone.define(
      'internal://test/langtests/createModel.malloy',
      createModel
    );
    translateWithSchemas(m);
    expect(m).toTranslate();
  });

  it('simple turducken', () => {
    const m = new TestTranslator(`
      query: aByAstr is a -> { group_by: astr }
      source: someSql is _db_.sql("""SELECT * FROM --MALLOY
        %{ aByAstr } --ENDMALLOY
         WHERE 1=1""")
    `);
    expect(m).toParse();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      expect(compileSql.selectStr).toMatch(
        /SELECT \* FROM --MALLOY.*--ENDMALLOY\n\s+WHERE 1=1/s
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
    const m = new TestTranslator(`
      source: sql_block is aConnection.sql("""${selStmt}""")
      source: malloy_source is sql_block extend { primary_key: ai }
    `);
    translateWithSchemas(m);
    expect(m).toTranslate();
    const modelDef = m.translate()?.modelDef;

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

  describe('interpolations in sql blocks', () => {
    test('non-persistable source in interpolation fails', () => {
      expect(
        'source: wrapper is aConnection.sql("""SELECT * FROM %{ a }""")'
      ).toLog(errorMessage('Cannot expand into a query'));
    });
    test('sql block as source in interpolation', () => {
      const m = model`
        source: sql_src is  aConnection.sql("""${selStmt}""")
        run: aConnection.sql("""SELECT * FROM %{ sql_src }""") -> { select: * }
      `;
      translateWithSchemas(m.translator);
      expect(m).toTranslate();
    });
    test('sql block as query in interpolation', () => {
      const m = model`
        query: sql_query is  aConnection.sql("""${selStmt}""")
        run: aConnection.sql("""SELECT * FROM %{ sql_query }""") -> { select: * }
      `;
      translateWithSchemas(m.translator);
      expect(m).toTranslate();
    });
    test('persistable query in interpolation', () => {
      const m = model`
        source: safe_query is  a -> { select: * }
        run: aConnection.sql("""SELECT * FROM %{ safe_query }""") -> { select: * }
      `;
      translateWithSchemas(m.translator);
      expect(m).toTranslate();
    });
  });

  describe('sourceRegistry', () => {
    test('sql source with sourceID is added to sourceRegistry', () => {
      const m = new TestTranslator(`
        source: sql_src is aConnection.sql("""${selStmt}""")
      `);
      translateWithSchemas(m);
      expect(m).toTranslate();
      const modelDef = m.translate().modelDef;
      expect(modelDef).toBeDefined();
      if (modelDef) {
        const src = m.getSourceDef('sql_src');
        expect(src).toBeDefined();
        expect(src?.type).toBe('sql_select');
        if (src && 'sourceID' in src && src.sourceID) {
          const registryValue = modelDef.sourceRegistry[src.sourceID];
          expect(registryValue).toBeDefined();
          expect(registryValue?.entry).toMatchObject({
            type: 'source_registry_reference',
            name: 'sql_src',
          });
        } else {
          fail('Expected sql_src to have a sourceID');
        }
      }
    });

    test('extending sql_select sets extends property to base sourceID', () => {
      const m = new TestTranslator(`
        source: base_sql is aConnection.sql("""${selStmt}""")

        source: extended_sql is base_sql extend {
          dimension: extra is 'test'
        }
      `);
      translateWithSchemas(m);
      expect(m).toTranslate();
      const modelDef = m.translate().modelDef;
      expect(modelDef).toBeDefined();
      if (modelDef) {
        const baseSrc = m.getSourceDef('base_sql');
        const extSrc = m.getSourceDef('extended_sql');
        expect(baseSrc).toBeDefined();
        expect(extSrc).toBeDefined();
        expect(baseSrc?.type).toBe('sql_select');
        expect(extSrc?.type).toBe('sql_select');

        // Base source should have sourceID
        if (baseSrc && 'sourceID' in baseSrc && baseSrc.sourceID) {
          const baseSourceID = baseSrc.sourceID;
          expect(baseSourceID).toContain('base_sql@');

          // Extended source should have extends pointing to base sourceID
          if (extSrc && 'extends' in extSrc) {
            expect(extSrc.extends).toBe(baseSourceID);
          } else {
            fail('Expected extended_sql to have extends property');
          }
        } else {
          fail('Expected base_sql to have a sourceID');
        }
      }
    });
  });
});
