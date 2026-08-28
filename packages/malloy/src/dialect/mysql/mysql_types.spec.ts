/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BasicAtomicTypeDef} from '../../model/malloy_types';
import {MySQLDialect} from './mysql';

const dialect = new MySQLDialect();

const integer: BasicAtomicTypeDef = {type: 'number', numberType: 'integer'};
const bigint: BasicAtomicTypeDef = {type: 'number', numberType: 'bigint'};
const float: BasicAtomicTypeDef = {type: 'number', numberType: 'float'};
const string: BasicAtomicTypeDef = {type: 'string'};
const native = (rawType: string): BasicAtomicTypeDef => ({
  type: 'sql native',
  rawType,
});

/**
 * Every distinct type spelling MySQL 8.4.2 was observed to report, from
 * `DESCRIBE` on declared columns and from `CREATE TABLE ... AS SELECT` on
 * expression results -- the two shapes `fetchTableSchema` and
 * `fetchSelectSchema` read. `DESCRIBE.Type` and
 * `information_schema.COLUMN_TYPE` agree byte-for-byte on all of them.
 *
 * These are the *reported* spellings, not the declarable ones. MySQL rewrites
 * every alias on write -- INTEGER to int, DEC/NUMERIC/FIXED to decimal, REAL
 * and DOUBLE PRECISION to double, BOOL/BOOLEAN to tinyint(1), SERIAL to
 * bigint unsigned, NCHAR to char -- so no alias can reach this map from a
 * schema read, and none is listed here.
 */
const reportedTypes: [string, BasicAtomicTypeDef][] = [
  // Integers. No modifier changes the type: `unsigned` only widens the range,
  // and the one type whose range crosses a Malloy boundary is already bigint.
  ['tinyint', integer],
  ['tinyint unsigned', integer],
  ['tinyint(1)', integer],
  ['tinyint(1) unsigned zerofill', integer],
  ['tinyint(3) unsigned zerofill', integer],
  ['smallint', integer],
  ['smallint unsigned', integer],
  ['mediumint', integer],
  ['mediumint unsigned', integer],
  ['int', integer],
  ['int unsigned', integer],
  ['int(10) unsigned zerofill', integer],
  ['bigint', bigint],
  ['bigint unsigned', bigint],
  ['bigint(20) unsigned zerofill', bigint],

  // Approximate numerics.
  ['float', float],
  ['float unsigned', float],
  ['float unsigned zerofill', float],
  ['float(10,2)', float],
  ['double', float],
  ['double unsigned', float],

  // DECIMAL is exact, so its scale decides whether it is a float, and its
  // precision decides whether it survives a JS double.
  ['decimal(10,2)', float],
  ['decimal(10,2) unsigned', float],
  ['decimal(10,2) unsigned zerofill', float],
  ['decimal(2,1)', float],
  ['decimal(5,4)', float],
  ['decimal(8,3)', float],
  ['decimal(10,0)', integer],
  ['decimal(15,0)', integer],
  ['decimal(16,0)', bigint],
  ['decimal(23,0)', bigint],
  ['decimal(65,0)', bigint],

  // Aggregates of an integer column are reported as DECIMAL, which is why the
  // rows above are reachable without anyone declaring a DECIMAL column.
  ['decimal(41,0)', bigint], // SUM(bigint)
  ['decimal(42,0)', bigint], // SUM(CAST(x AS SIGNED))
  ['decimal(43,0)', bigint], // SUM(CAST(x AS UNSIGNED))
  ['decimal(23,4)', float], // AVG(bigint)

  // Text. longtext is what JSON_UNQUOTE(JSON_EXTRACT(...)) reports.
  ['char(1)', string],
  ['char(10)', string],
  ['varchar(20)', string],
  ['tinytext', string],
  ['text', string],
  ['mediumtext', string],
  ['longtext', string],

  // Temporal. datetime is a wall clock and timestamp a session-rendered
  // instant, but the UTC session pin makes them coincide; they split when
  // Malloy gets a datetime type. Nothing carries fractional-second precision.
  ['date', {type: 'date'}],
  ['datetime', {type: 'timestamp'}],
  ['datetime(6)', {type: 'timestamp'}],
  ['timestamp', {type: 'timestamp'}],
  ['timestamp(6)', {type: 'timestamp'}],
  ['time', string],
  ['time(3)', string],

  // Bytes. Malloy has no bytes type and the driver returns a Buffer, so the
  // whole family stays opaque -- varbinary included.
  ['binary(1)', native('binary')],
  ['varbinary(20)', native('varbinary')],
  ['tinyblob', native('tinyblob')],
  ['blob', native('blob')],
  ['mediumblob', native('mediumblob')],
  ['longblob', native('longblob')],

  // Deliberately opaque. `enum` orders by declaration index but aggregates
  // lexically, so calling it a string would make order_by silently mean
  // something else. `set` is a comma-joined multi-value. `bit` cannot be
  // told from bit(8). `year` has a 0000 value with no Malloy spelling. `json`
  // is opaque on seven of eight dialects, and unnestColumns reads its
  // rawType to pick the JSON_TABLE column type.
  ["enum('a','b')", native('enum')],
  ["set('x','y')", native('set')],
  ['bit(1)', native('bit')],
  ['bit(8)', native('bit')],
  ['year', native('year')],
  ['json', native('json')],

  // Spatial.
  ['geometry', native('geometry')],
  ['point', native('point')],
  ['linestring', native('linestring')],
  ['polygon', native('polygon')],
  ['multipoint', native('multipoint')],
  ['multilinestring', native('multilinestring')],
  ['multipolygon', native('multipolygon')],
  ['geomcollection', native('geomcollection')],
];

describe('mysql schema types', () => {
  test.each(reportedTypes)('%s', (sqlType, expected) => {
    expect(dialect.sqlTypeToMalloyType(sqlType)).toEqual(expected);
  });

  test('an unrecognized type is opaque, keyed on the base name', () => {
    expect(dialect.sqlTypeToMalloyType('nosuchtype(3) unsigned')).toEqual(
      native('nosuchtype')
    );
  });

  test('the reported spelling may be any case', () => {
    expect(dialect.sqlTypeToMalloyType('BIGINT UNSIGNED')).toEqual(bigint);
    expect(dialect.sqlTypeToMalloyType('DECIMAL(20,0)')).toEqual(bigint);
  });
});

describe('mysql JSON_TABLE column types', () => {
  // JSON_TABLE silently returns NULL for a value its declared column type
  // cannot hold, so an integer must not be declared INT -- Malloy's `integer`
  // is not bounded at 32 bits, and MySQL's INT is.
  test.each([
    [integer, 'BIGINT'],
    [bigint, 'BIGINT'],
    [float, 'DOUBLE'],
  ])('%p unnests as %s', (typeDef, expected) => {
    const unnest = dialect.unnestColumns([
      {typeDef, sqlExpression: 'x', rawName: 'x', sqlOutputName: 'x'},
    ]);
    expect(unnest).toContain(expected);
  });
});
