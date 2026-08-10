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

import {
  answerSQLSchemaRequests,
  error,
  errorMessage,
  markSource,
  model,
} from './test-translator';
import './parse-expects';

describe('cross connection references are errors', () => {
  describe('joins', () => {
    test('join_one from another connection', () => {
      expect(markSource`
        source: xa is _db_.table('aTable')
        source: xb is _db2_.table('aTable')
        run: xa extend { join_one: ${'xb on astr = xb.astr'} } -> { group_by: xb.astr }
      `).toLog(
        errorMessage(
          "Cannot join 'xb', which is on connection '_db2_', " +
            "into a source on connection '_db_'"
        )
      );
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
    test('a base whose schema failed does not also report a connection', () => {
      // The error source stands in for a base whose schema never arrived, and
      // its connection is a sentinel. Reporting it would put `~unknown~` in
      // front of a user who has a real error to read already.
      const translator = model`
        source: xa is _db_.table('noSuchTable') extend {
          join_one: a on astr = a.astr
        }
      `.translator;
      translator.translate();
      translator.update({
        errors: {tables: {'_db_:noSuchTable': 'no such table'}},
      });
      translator.translate();
      const codes = translator.logger.getLog().map(l => l.code);
      expect(codes).toContain('failed-to-fetch-table-schema');
      expect(codes).not.toContain('join-connection-mismatch');
    });
    test('the connection check also catches a cross-dialect join', () => {
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
      answerSQLSchemaRequests(translator);
      expect(translator).toTranslate();
    });
  });
});
