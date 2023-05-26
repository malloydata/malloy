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
  SQLBlockSource,
  SQLBlockStructDef,
  StructDef,
  isSQLBlockStruct,
  isSQLFragment,
} from '../../model';
import {makeSQLBlock} from '../../model/sql_block';
import {TestTranslator, aTableDef} from './test-translator';
import './parse-expects';
import {MalloyTranslator} from '../parse-malloy';

function unlocatedStructDef(sd: StructDef): StructDef {
  const ret = {...sd};
  ret.fields = sd.fields.map(f => {
    const nf = {...f};
    delete nf.location;
    return nf;
  });
  delete ret.location;
  return ret;
}

describe('sql:', () => {
  const selStmt = 'SELECT * FROM aTable';
  function makeSchemaResponse(sql: SQLBlockSource): SQLBlockStructDef {
    const cname = sql.connection || 'bigquery';
    return {
      type: 'struct',
      name: sql.name,
      dialect: 'standardsql',
      structSource: {
        type: 'sql',
        method: 'subquery',
        sqlBlock: {
          type: 'sqlBlock',
          ...sql,
          selectStr: sql.select.filter(s => typeof s === 'string').join(''),
        },
      },
      structRelationship: {type: 'basetable', connectionName: cname},
      fields: aTableDef.fields,
    };
  }

  test('definition', () => {
    const model = new TestTranslator(`
      sql: users IS {
        select: """${selStmt}"""
        connection: "aConnection"
      }
    `);
    const needReq = model.translate();
    expect(model).modelParsed();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    if (needs) {
      const sql = makeSQLBlock([{sql: selStmt}], 'aConnection');
      expect(needs).toMatchObject(sql);
      const refKey = needs.name;
      expect(refKey).toBeDefined();
      if (refKey) {
        const sr = makeSchemaResponse(sql);
        model.update({compileSQL: {[refKey]: sr}});
        expect(model).modelCompiled();
        const expectThis = unlocatedStructDef({...sr, as: 'users'});
        if (isSQLBlockStruct(expectThis)) {
          expectThis.declaredSQLBlock = true;
        }
        expect(unlocatedStructDef(model.sqlBlocks[0])).toEqual(expectThis);
      }
    }
  });

  test('source from sql', () => {
    const model = new TestTranslator(`
      sql: users IS { select: """${selStmt}""" }
      source: malloyUsers is from_sql(users) { primary_key: ai }
    `);
    expect(model).modelParsed();
    const needReq = model.translate();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    if (needs) {
      const sql = makeSQLBlock([{sql: selStmt}], 'aConnection');
      const refKey = needs.name;
      model.update({compileSQL: {[refKey]: makeSchemaResponse(sql)}});
      expect(model).modelCompiled();
      const users = model.getSourceDef('malloyUsers');
      expect(users).toBeDefined();
      if (users && isSQLBlockStruct(users)) {
        expect(users.declaredSQLBlock).toBeUndefined();
      }
    }
  });

  test('explore from imported sql-based-source', () => {
    const createModel = `
      sql: users IS { select: """${selStmt}""" }
      source: malloyUsers is from_sql(users) { primary_key: ai }
    `;
    const model = new TestTranslator(`
      import "createModel.malloy"
      source: importUsers is malloyUsers
      query: malloyUsers -> { project: * }
      query: importUsers -> { project: * }
    `);
    model.importZone.define(
      'internal://test/langtests/createModel.malloy',
      createModel
    );
    expect(model).modelParsed();
    const needReq = model.translate();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    const sql = makeSQLBlock([{sql: selStmt}]);
    model.update({compileSQL: {[sql.name]: makeSchemaResponse(sql)}});
    expect(model).modelCompiled();
  });

  it('turducken', () => {
    const m = new TestTranslator(`
      sql: someSql is {
        select: """SELECT * FROM %{ a -> { group_by: astr } }% WHERE 1=1"""
      }
    `);
    expect(m).modelParsed();
    const compileSql = m.translate().compileSQL;
    expect(compileSql).toBeDefined();
    if (compileSql) {
      const select = compileSql.select[0];
      const star = compileSql.select[1];
      const where = compileSql.select[2];
      expect(select).toEqual({sql: 'SELECT * FROM '});
      expect(isSQLFragment(star)).toBeFalsy();
      expect(where).toEqual({sql: ' WHERE 1=1'});
    }
  });
  it('model preserved', () => {
    const shouldBeOK = `
      source: newa is a
      sql: someSql is { select: """${selStmt}""" }
      source: newaa is newa
    `;
    const model = new TestTranslator(shouldBeOK);
    expect(model).modelParsed();
    const needReq = model.translate();
    const needs = needReq?.compileSQL;
    expect(needs).toBeDefined();
    const sql = makeSQLBlock([{sql: selStmt}]);
    model.update({compileSQL: {[sql.name]: makeSchemaResponse(sql)}});
    expect(model).modelCompiled();
  });

  test('explore from extended sql-based-source', () => {
    const model = new TestTranslator(`
      sql: sql_block IS { select: """${selStmt}""" }
      source: malloy_source is from_sql(sql_block) { primary_key: ai }
`);
    const sql = makeSQLBlock([{sql: selStmt}]);
    model.update({compileSQL: {[sql.name]: makeSchemaResponse(sql)}});
    expect(model).modelCompiled();
    const modelDef = model?.translate()?.translated?.modelDef;

    const extModel = new MalloyTranslator('sqlblocktest://main');
    extModel.importZone.define(
      'sqlblocktest://main',
      'query: malloy_source -> { project: * }'
    );
    extModel.translate(modelDef);
    expect(extModel).toBeErrorless();
  });
});
