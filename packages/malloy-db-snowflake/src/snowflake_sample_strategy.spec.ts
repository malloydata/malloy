/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryRecord} from '@malloydata/malloy';
import {
  pickSampleStrategy,
  sampleVariantBlocks,
  VARIANT_SAMPLE_BLOCK_PERCENTS,
} from './snowflake_connection';
import {parseSnowflakeTableName} from './snowflake_table_name';

describe('pickSampleStrategy', () => {
  const threshold = 100_000_000;

  test('no probe → best-effort tablesample-then-limit', () => {
    expect(pickSampleStrategy(undefined, threshold)).toBe(
      'tablesample-then-limit'
    );
  });

  test('probe at or below threshold → full-scan-then-sample', () => {
    expect(pickSampleStrategy({bytes: 0, rowCount: 0}, threshold)).toBe(
      'full-scan-then-sample'
    );
    expect(pickSampleStrategy({bytes: threshold, rowCount: 1}, threshold)).toBe(
      'full-scan-then-sample'
    );
  });

  test('probe above threshold → tablesample-only (no unsafe LIMIT fallback)', () => {
    expect(
      pickSampleStrategy({bytes: threshold + 1, rowCount: 1}, threshold)
    ).toBe('tablesample-only');
    expect(
      pickSampleStrategy(
        {bytes: 10_000_000_000, rowCount: 1_000_000_000},
        threshold
      )
    ).toBe('tablesample-only');
  });

  test('threshold=0 forces every probed table into tablesample-only', () => {
    expect(pickSampleStrategy({bytes: 1, rowCount: 1}, 0)).toBe(
      'tablesample-only'
    );
  });
});

describe('sampleVariantBlocks', () => {
  const rows = (n: number): QueryRecord[] =>
    Array.from({length: n}, (_, i) => ({N: i}));

  test('returns the first non-empty draw and does not escalate', async () => {
    const tried: number[] = [];
    const result = await sampleVariantBlocks(blockPercent => {
      tried.push(blockPercent);
      return Promise.resolve(rows(3));
    });
    expect(result).toHaveLength(3);
    expect(tried).toEqual([1]);
  });

  test('escalates past an empty draw until one returns rows', async () => {
    const tried: number[] = [];
    const result = await sampleVariantBlocks(blockPercent => {
      tried.push(blockPercent);
      return Promise.resolve(blockPercent >= 10 ? rows(2) : []);
    });
    expect(result).toHaveLength(2);
    expect(tried).toEqual([1, 10]);
  });

  test('treats an errored (undefined) draw like empty and continues', async () => {
    const tried: number[] = [];
    const result = await sampleVariantBlocks(blockPercent => {
      tried.push(blockPercent);
      return Promise.resolve(blockPercent >= 50 ? rows(1) : undefined);
    });
    expect(result).toHaveLength(1);
    expect(tried).toEqual([...VARIANT_SAMPLE_BLOCK_PERCENTS]);
  });

  test('returns undefined when every percentage comes back empty', async () => {
    const tried: number[] = [];
    const result = await sampleVariantBlocks(blockPercent => {
      tried.push(blockPercent);
      return Promise.resolve([]);
    });
    expect(result).toBeUndefined();
    expect(tried).toEqual([...VARIANT_SAMPLE_BLOCK_PERCENTS]);
  });

  test('honors a custom percentage ladder, in order', async () => {
    const tried: number[] = [];
    await sampleVariantBlocks(
      blockPercent => {
        tried.push(blockPercent);
        return Promise.resolve([]);
      },
      [5, 25]
    );
    expect(tried).toEqual([5, 25]);
  });
});

describe('parseSnowflakeTableName', () => {
  test('single bare identifier', () => {
    expect(parseSnowflakeTableName('aircraft')).toEqual({
      table: {literal: 'AIRCRAFT', sql: 'AIRCRAFT', quoted: false},
    });
  });

  test('two-part bare name uppercases both parts', () => {
    expect(parseSnowflakeTableName('malloytest.aircraft')).toEqual({
      schema: {literal: 'MALLOYTEST', sql: 'MALLOYTEST', quoted: false},
      table: {literal: 'AIRCRAFT', sql: 'AIRCRAFT', quoted: false},
    });
  });

  test('three-part bare name', () => {
    expect(parseSnowflakeTableName('db.sch.t')).toEqual({
      database: {literal: 'DB', sql: 'DB', quoted: false},
      schema: {literal: 'SCH', sql: 'SCH', quoted: false},
      table: {literal: 'T', sql: 'T', quoted: false},
    });
  });

  test('quoted identifier preserves case', () => {
    expect(parseSnowflakeTableName('"MyDb"."schema"."t"')).toEqual({
      database: {literal: 'MyDb', sql: '"MyDb"', quoted: true},
      schema: {literal: 'schema', sql: '"schema"', quoted: true},
      table: {literal: 't', sql: '"t"', quoted: true},
    });
  });

  test('quoted identifier allows embedded dots', () => {
    expect(parseSnowflakeTableName('"a.b"."c.d"')).toEqual({
      schema: {literal: 'a.b', sql: '"a.b"', quoted: true},
      table: {literal: 'c.d', sql: '"c.d"', quoted: true},
    });
  });

  test('doubled double-quote is a literal quote', () => {
    expect(parseSnowflakeTableName('"a""b"')).toEqual({
      table: {literal: 'a"b', sql: '"a""b"', quoted: true},
    });
  });

  test('mixes quoted and bare parts', () => {
    expect(parseSnowflakeTableName('MYDB."mixed"')).toEqual({
      schema: {literal: 'MYDB', sql: 'MYDB', quoted: false},
      table: {literal: 'mixed', sql: '"mixed"', quoted: true},
    });
  });

  test('tolerates surrounding whitespace and whitespace around dots', () => {
    expect(parseSnowflakeTableName(' sch . t ')).toEqual({
      schema: {literal: 'SCH', sql: 'SCH', quoted: false},
      table: {literal: 'T', sql: 'T', quoted: false},
    });
  });

  test('returns undefined for empty input', () => {
    expect(parseSnowflakeTableName('')).toBeUndefined();
  });

  test('returns undefined for four-part name', () => {
    expect(parseSnowflakeTableName('a.b.c.d')).toBeUndefined();
  });

  test('returns undefined for trailing dot', () => {
    expect(parseSnowflakeTableName('sch.')).toBeUndefined();
  });

  test('returns undefined for leading dot', () => {
    expect(parseSnowflakeTableName('.t')).toBeUndefined();
  });

  test('returns undefined for unterminated quoted identifier', () => {
    expect(parseSnowflakeTableName('"oops')).toBeUndefined();
  });

  test('returns undefined for identifier starting with a digit', () => {
    expect(parseSnowflakeTableName('1foo')).toBeUndefined();
  });

  test('returns undefined for identifier containing a dash', () => {
    expect(parseSnowflakeTableName('foo-bar')).toBeUndefined();
  });
});
