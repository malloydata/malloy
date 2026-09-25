/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import type {GetQueryResultsCommandOutput} from '@aws-sdk/client-athena';
import {
  informationSchemaColumnsSQL,
  schemaFromTrinoExplain,
  tablePathParts,
} from './athena_schema';

describe('tablePathParts', () => {
  it('splits on dots outside quotes and strips the quotes', () => {
    expect(tablePathParts('t')).toEqual(['t']);
    expect(tablePathParts('db.t')).toEqual(['db', 't']);
    expect(tablePathParts('cat.db.t')).toEqual(['cat', 'db', 't']);
    expect(tablePathParts('"My.Db"."a""b"')).toEqual(['My.Db', 'a"b']);
  });
});

describe('informationSchemaColumnsSQL', () => {
  it('filters on the lowercased database and table, in the connection catalog', () => {
    expect(
      informationSchemaColumnsSQL('MallOyTest.Flights', undefined)
    ).toEqual({
      sql:
        'SELECT column_name, data_type FROM information_schema.columns' +
        " WHERE table_schema = 'malloytest' AND table_name = 'flights'" +
        ' ORDER BY ordinal_position',
    });
  });

  it('reads a three-part path from that catalog and a one-part path from the default database', () => {
    expect(informationSchemaColumnsSQL('other.db.t', 'dflt')).toEqual({
      sql:
        'SELECT column_name, data_type FROM "other".information_schema.columns' +
        " WHERE table_schema = 'db' AND table_name = 't'" +
        ' ORDER BY ordinal_position',
    });
    expect(informationSchemaColumnsSQL("it's", 'dflt')).toEqual({
      sql:
        'SELECT column_name, data_type FROM information_schema.columns' +
        " WHERE table_schema = 'dflt' AND table_name = 'it''s'" +
        ' ORDER BY ordinal_position',
    });
  });

  it('refuses a one-part path with no default database, and a malformed path', () => {
    expect(informationSchemaColumnsSQL('t', undefined)).toEqual({
      error:
        "Table path 't' names no database and the connection has no default database",
    });
    expect(informationSchemaColumnsSQL('a.b.c.d', 'x')).toHaveProperty('error');
    expect(informationSchemaColumnsSQL('a..c', 'x')).toHaveProperty('error');
  });
});

describe('schemaFromTrinoExplain', () => {
  // The EXPLAIN of `SELECT 1 AS n, CAST(ROW(1,'x') AS ROW(n integer, s varchar)) AS r,
  // ARRAY[1] AS a, TIMESTAMP '2024-01-02 03:04:05' AS t`, recorded from engine v3.
  const recorded: GetQueryResultsCommandOutput = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'fixtures', 'explain.results.json'),
      'utf8'
    )
  );
  const planLines = (recorded.ResultSet?.Rows ?? [])
    .slice(1)
    .map(row => row.Data?.[0].VarCharValue ?? '');

  it('reads each output column and its full type from the Output node', () => {
    expect(schemaFromTrinoExplain(planLines)).toEqual([
      {name: 'n', type: 'integer'},
      {name: 'r', type: 'row(n integer, s varchar)'},
      {name: 'a', type: 'array(integer)'},
      {name: 't', type: 'timestamp(0)'},
    ]);
  });

  it('takes a column named like its symbol without an assignment line, and unquotes a quoted name', () => {
    expect(
      schemaFromTrinoExplain([
        'Fragment 0 [SINGLE]',
        '    Output[columnNames = [x, "Mixed Case", m]]',
        '    │   Layout: [x:bigint, expr:varchar(3), m:map(varchar, integer)]',
        '    │   Estimates: {rows: 1 (124B), cpu: 0, memory: 0B, network: 0B}',
        '    │   "Mixed Case" := expr',
        '    └─ Values[]',
        '           Layout: [x:bigint, expr:varchar(3)]',
        '           x := 1',
      ])
    ).toEqual([
      {name: 'x', type: 'bigint'},
      {name: 'Mixed Case', type: 'varchar(3)'},
      {name: 'm', type: 'map(varchar, integer)'},
    ]);
  });

  it('refuses a plan with no Output node', () => {
    expect(() => schemaFromTrinoExplain(['Fragment 0 [SINGLE]'])).toThrow(
      'no Output node'
    );
  });
});
