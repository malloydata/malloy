/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MySQLDialect} from './mysql';
import {SQLServerDialect} from './sqlserver';
import {StandardSQLDialect} from './standardsql';

describe('Dialect booleans', () => {
  const noBooleans = new SQLServerDialect();
  const booleans = new StandardSQLDialect();

  test('a dialect with no boolean type spells both literals as conditions', () => {
    expect(noBooleans.sqlBoolean(true)).toBe('(1=1)');
    expect(noBooleans.sqlBoolean(false)).toBe('(1=0)');
  });

  test('a dialect with no boolean type spells a literal value as 1 or 0', () => {
    expect(noBooleans.sqlBooleanValue(true)).toBe('1');
    expect(noBooleans.sqlBooleanValue(false)).toBe('0');
  });

  test('a dialect with booleans spells a literal the same in either form', () => {
    expect(booleans.sqlBoolean(true)).toBe('true');
    expect(booleans.sqlBooleanValue(true)).toBe('true');
    expect(booleans.sqlBoolean(false)).toBe('false');
    expect(booleans.sqlBooleanValue(false)).toBe('false');
  });

  test('a condition becomes a value which is NULL when the condition is', () => {
    expect(noBooleans.sqlConditionAsValue('a > b')).toBe(
      'CASE WHEN a > b THEN 1 WHEN NOT (a > b) THEN 0 END'
    );
    expect(booleans.sqlConditionAsValue('a > b')).toBe('a > b');
  });

  test('a value becomes a condition by comparing it with 1', () => {
    expect(noBooleans.sqlValueAsCondition('x')).toBe('(x = 1)');
    expect(booleans.sqlValueAsCondition('x')).toBe('x');
  });

  test('not, and a comparison true on NULL, keep COALESCE where there are booleans', () => {
    expect(booleans.sqlNot('c')).toBe('COALESCE(NOT c,TRUE)');
    expect(booleans.sqlNullIsTrue('c')).toBe('COALESCE(c,true)');
  });

  test('not, and a comparison true on NULL, are written without a boolean value', () => {
    expect(noBooleans.sqlNot('c')).toBe('(CASE WHEN c THEN 1 ELSE 0 END = 0)');
    expect(noBooleans.sqlNullIsTrue('c')).toBe(
      '(CASE WHEN NOT (c) THEN 1 ELSE 0 END = 0)'
    );
  });
});

describe('Dialect ORDER BY and row limit', () => {
  // MySQL uses the base sqlOrderBy, so this is the base composition
  const plain = new MySQLDialect();

  test('the ordering then a LIMIT line, each only when present', () => {
    expect(plain.sqlOrderByLimit(['1 ASC'], 10)).toBe(
      'ORDER BY 1 ASC\nLIMIT 10\n'
    );
    expect(plain.sqlOrderByLimit(['1 ASC'], undefined)).toBe(
      'ORDER BY 1 ASC\n'
    );
    expect(plain.sqlOrderByLimit([], 10)).toBe('LIMIT 10\n');
    expect(plain.sqlOrderByLimit([], undefined)).toBe('');
  });
});
