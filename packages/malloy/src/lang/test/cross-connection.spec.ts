/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/*
 * Malloy has no way to execute a query which spans two connections, so
 * everything a query reaches has to be on the connection the query runs on.
 * These tests cover the places where a second connection can be named and
 * therefore has to be rejected.
 */

import type {SQLSourceDef} from '../../model';
import {sqlKey} from '../../model/sql_block';
import type {TestTranslator} from './test-translator';
import {
  TEST_DIALECT,
  aTableDef,
  error,
  markSource,
  model,
} from './test-translator';
import './parse-expects';

/**
 * Answer every SQL schema request with the schema of `aTable`, on whichever
 * connection asked for it, until the translation stops asking.
 */
function answerSchemaRequests(translator: TestTranslator): void {
  for (;;) {
    const compileSQL = translator.translate().compileSQL;
    if (compileSQL === undefined) return;
    const key = sqlKey(compileSQL.connection, compileSQL.selectStr);
    const schema: SQLSourceDef = {
      type: 'sql_select',
      name: key,
      dialect: TEST_DIALECT,
      connection: compileSQL.connection,
      selectStr: compileSQL.selectStr,
      fields: aTableDef.fields,
    };
    translator.update({compileSQL: {[key]: schema}});
  }
}

describe('cross connection references are errors', () => {
  describe('joins', () => {
    test('join_one from another connection', () => {
      expect(markSource`
        source: xa is _db_.table('aTable')
        source: xb is _db2_.table('aTable')
        run: xa extend { join_one: ${'xb on astr = xb.astr'} } -> { group_by: xb.astr }
      `).toLog(error('join-connection-mismatch'));
    });
    test('join_many from another connection', () => {
      expect(markSource`
        source: xb is _db2_.table('aTable')
        run: a extend { join_many: ${'xb on astr = xb.astr'} } -> { group_by: xb.astr }
      `).toLog(error('join-connection-mismatch'));
    });
    test('join_cross from another connection', () => {
      expect(markSource`
        source: xb is _db2_.table('aTable')
        run: a extend { join_cross: ${'xb'} } -> { group_by: xb.astr }
      `).toLog(error('join-connection-mismatch'));
    });
    test('join in a source extension', () => {
      expect(markSource`
        source: xb is _db2_.table('aTable')
        source: xa is a extend { join_one: ${'xb on astr = xb.astr'} }
      `).toLog(error('join-connection-mismatch'));
    });
    test('join with a primary key', () => {
      expect(markSource`
        source: xb is _db2_.table('aTable') extend { primary_key: astr }
        source: xa is a extend { join_one: ${'xb with astr'} }
      `).toLog(error('join-connection-mismatch'));
    });
    test('join of a query on another connection', () => {
      expect(markSource`
        source: xb is _db2_.table('aTable')
        source: xa is a extend {
          join_one: xq is ${'xb -> { group_by: astr }'} on astr = xq.astr
        }
      `).toLog(error('join-connection-mismatch'));
    });
    test('join of a source on another dialect', () => {
      expect(markSource`
        run: a extend { join_one: ${'bq_a on astr = bq_a.astr'} } -> { group_by: bq_a.astr }
      `).toLog(error('join-connection-mismatch'));
    });
    test('joining into the other connection is also an error', () => {
      expect(markSource`
        source: xb is _db2_.table('aTable')
        source: xa is xb extend { join_one: ${'a on astr = a.astr'} }
      `).toLog(error('join-connection-mismatch'));
    });
  });

  describe('sql() interpolation', () => {
    test('query from another connection', () => {
      expect(markSource`
        source: xa is _db_.table('aTable') -> { group_by: astr }
        source: xs is _db2_.sql("""SELECT * FROM %{ ${'xa -> { select: * }'} }""")
      `).toLog(error('sql-source-connection-mismatch'));
    });
    test('source from another connection', () => {
      expect(markSource`
        source: xq is _db2_.table('aTable') -> { select: * }
        source: xs is _db_.sql("""SELECT * FROM %{ ${'xq'} }""")
      `).toLog(error('sql-source-connection-mismatch'));
    });
    test('wrong connection and not persistable both report', () => {
      // `a` is a table, so it can never be interpolated, and it is also on
      // the wrong connection. Both complaints belong to the same element, so
      // both are logged.
      expect(markSource`
        source: xs is _db2_.sql("""SELECT * FROM %{ ${'a'} }""")
      `).toLog(
        error('sql-source-connection-mismatch'),
        error('invalid-sql-source-interpolation')
      );
    });
    test('a rejected interpolation does not ask for a schema', () => {
      const translator = model`
        source: xa is _db_.table('aTable') -> { group_by: astr }
        source: xs is _db2_.sql("""SELECT * FROM %{ xa -> { select: * } }""")
      `.translator;
      const response = translator.translate();
      expect(response).not.toHaveProperty('compileSQL');
      expect(response.final).toBe(true);
    });
  });

  describe('single connection references still translate', () => {
    test('a second connection is usable on its own', () => {
      expect(`
        source: xb is _db2_.table('aTable')
        run: xb -> { group_by: astr }
      `).toTranslate();
    });
    test('join within the second connection', () => {
      expect(`
        source: xb is _db2_.table('aTable')
        run: xb extend { join_one: xb2 is _db2_.table('aTable') on astr = xb2.astr }
          -> { group_by: xb2.astr }
      `).toTranslate();
    });
    test('interpolation within the second connection', () => {
      const translator = model`
        source: xa is _db2_.table('aTable') -> { group_by: astr }
        source: xs is _db2_.sql("""SELECT * FROM %{ xa -> { select: * } }""")
      `.translator;
      answerSchemaRequests(translator);
      expect(translator).toTranslate();
    });
  });
});
