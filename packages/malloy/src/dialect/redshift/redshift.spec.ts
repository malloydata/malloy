/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {getDialect, getDialects} from '../dialect_map';
import {RedshiftDialect} from './redshift';
import {expandOverrideMap} from '../functions';
import {REDSHIFT_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

describe('redshift dialect', () => {
  const redshift = new RedshiftDialect();

  describe('registration', () => {
    it('is registered under the name "redshift"', () => {
      expect(getDialect('redshift')).toBeInstanceOf(RedshiftDialect);
      expect(getDialects().some(d => d.name === 'redshift')).toBe(true);
    });
  });

  describe('filtered aggregates use CASE WHEN, never FILTER (WHERE …)', () => {
    it('sqlAnyValueLastTurtle emits CASE WHEN and not FILTER', () => {
      const sql = redshift.sqlAnyValueLastTurtle('"col"', 3, 'out');
      expect(sql).toContain('CASE WHEN');
      expect(sql).toContain('group_set=3');
      expect(sql).not.toMatch(/FILTER\s*\(/i);
    });

    it('no dialect override SQL contains FILTER (WHERE …)', () => {
      const overrides = expandOverrideMap(REDSHIFT_MALLOY_STANDARD_OVERLOADS);
      const allSQL = JSON.stringify(overrides);
      expect(allSQL).not.toMatch(/FILTER\s*\(/i);
    });
  });

  describe('TIMESTAMPTZ (supported, inherited from Postgres)', () => {
    it('reports hasTimestamptz = true', () => {
      expect(redshift.hasTimestamptz).toBe(true);
    });

    it('emits a TIMESTAMPTZ literal carrying the timezone', () => {
      const sql = redshift.sqlTimestamptzLiteral(
        {queryTimezone: undefined},
        '2021-02-24 03:05:06',
        'America/Mexico_City'
      );
      expect(sql).toContain('TIMESTAMPTZ');
      expect(sql).toContain('America/Mexico_City');
    });
  });

  describe('inherited Postgres SQL that Redshift rejects is overridden', () => {
    it('group_set fan-out is UNION ALL, never GENERATE_SERIES', () => {
      const sql = redshift.sqlGroupSetTable(3);
      expect(sql).not.toMatch(/GENERATE_SERIES/i);
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain('group_set');
    });

    it('UUID generation avoids GEN_RANDOM_UUID', () => {
      expect(redshift.sqlGenerateUUID()).not.toMatch(/GEN_RANDOM_UUID/i);
    });

    it('symmetric-aggregate hashed key avoids ::bit and DECIMAL(65)', () => {
      const sql = redshift.sqlSumDistinctHashedKey('"k"');
      expect(sql).not.toContain('::bit');
      expect(sql).not.toContain('DECIMAL(65');
    });

    it('sampling avoids TABLESAMPLE', () => {
      const rows = redshift.sqlSampleTable('t', {rows: 100});
      const pct = redshift.sqlSampleTable('t', {percent: 10});
      expect(rows).not.toMatch(/TABLESAMPLE/i);
      expect(pct).not.toMatch(/TABLESAMPLE/i);
    });

    it('time offset uses DATEADD, never make_interval', () => {
      const sql = redshift.sqlOffsetTime(
        '"d"',
        '-',
        '3',
        'month',
        {type: 'date'},
        false
      );
      expect(sql).toContain('DATEADD');
      expect(sql).not.toMatch(/make_interval/i);
    });

    it('time offset round-trips a timestamptz through AT TIME ZONE UTC', () => {
      const sql = redshift.sqlOffsetTime(
        '"t"',
        '-',
        '3',
        'hour',
        {type: 'timestamptz'},
        false
      );
      expect(sql).toBe(
        "(DATEADD(hour, (-(3))::integer, (\"t\") AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC'"
      );
    });

    it('time offset leaves a plain timestamp and civil-time values uncast', () => {
      expect(
        redshift.sqlOffsetTime(
          '"t"',
          '-',
          '3',
          'hour',
          {type: 'timestamp'},
          false
        )
      ).toBe('DATEADD(hour, (-(3))::integer, "t")');
      expect(
        redshift.sqlOffsetTime(
          '"t"',
          '-',
          '3',
          'hour',
          {type: 'timestamptz'},
          true
        )
      ).toBe('DATEADD(hour, (-(3))::integer, "t")');
    });
  });

  describe('identifier quoting', () => {
    it('quotes with double quotes and doubles embedded quotes', () => {
      expect(redshift.sqlQuoteIdentifier('plain')).toBe('"plain"');
      expect(redshift.sqlQuoteIdentifier('we"ird')).toBe('"we""ird"');
    });

    it('limits identifiers to 127 characters (Redshift limit)', () => {
      expect(redshift.maxIdentifierLength).toBe(127);
    });
  });

  describe('string literals use backslash escaping', () => {
    it('escapes quote, backslash, and newline; never emits E-strings', () => {
      expect(redshift.sqlLiteralString("O'Brien")).toBe("'O\\'Brien'");
      expect(redshift.sqlLiteralString('a\\b')).toBe("'a\\\\b'");
      expect(redshift.sqlLiteralString('l1\nl2')).toBe("'l1\\nl2'");
      expect(redshift.sqlLiteralString('l1\nl2')).not.toMatch(/E'/);
    });
  });

  describe('nesting / array / record disabled', () => {
    it('reports nesting capability flags as off', () => {
      expect(redshift.supportsNesting).toBe(false);
      expect(redshift.nestedArrays).toBe(false);
      expect(redshift.supportsArraysInData).toBe(false);
    });

    it('errors cleanly on nested-aggregate generation', () => {
      expect(() => redshift.sqlAggregateTurtle(0, [], undefined)).toThrow(
        /nested aggregates/
      );
      expect(() => redshift.sqlCoaleseMeasuresInline(0, [])).toThrow(
        /nested aggregates/
      );
    });

    it('errors cleanly on array and record literals', () => {
      const arrLit = {
        node: 'arrayLiteral',
        typeDef: {type: 'array', elementTypeDef: {type: 'number'}},
        kids: {values: []},
      } as never;
      const recLit = {
        node: 'recordLiteral',
        typeDef: {type: 'record', fields: []},
        kids: {},
      } as never;
      expect(() => redshift.sqlLiteralArray(arrLit)).toThrow(/array literals/);
      expect(() => redshift.sqlLiteralRecord(recLit)).toThrow(
        /record literals/
      );
    });
  });

  describe('UDF-dependent features disabled', () => {
    it('does not use the pg_temp.__udf prefix', () => {
      expect(redshift.udfPrefix).not.toContain('pg_temp');
    });

    it('errors cleanly when asked to create a generated SQL UDF', () => {
      expect(() => redshift.sqlCreateFunction('id', 'body')).toThrow(/UDF/);
    });
  });

  describe('string aggregation uses LISTAGG (no STRING_AGG)', () => {
    it('emits LISTAGG … WITHIN GROUP for string_agg', () => {
      const fns = redshift.getDialectFunctions();
      const allSQL = JSON.stringify(fns);
      expect(allSQL).toContain('LISTAGG');
      expect(allSQL).toContain('WITHIN GROUP');
      expect(allSQL).not.toContain('STRING_AGG');
    });
  });

  describe('type mapping (inherited Postgres scalar mapping)', () => {
    it('maps timestamp without time zone to timestamp', () => {
      expect(
        redshift.sqlTypeToMalloyType('timestamp without time zone')
      ).toEqual({type: 'timestamp'});
    });

    it('maps unknown types to sql native', () => {
      expect(redshift.sqlTypeToMalloyType('super')).toEqual({
        type: 'sql native',
        rawType: 'super',
      });
    });
  });
});
