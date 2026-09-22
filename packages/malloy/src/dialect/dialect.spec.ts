/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Dialect, EscapeStyle} from './dialect';

// Prototype-only instances: the hooks under test read only the fields set here.
function dialectWith(fields: Partial<Dialect>): Dialect {
  return Object.assign(Object.create(Dialect.prototype) as Dialect, fields);
}

describe('Dialect booleans', () => {
  const noBooleans = dialectWith({booleanType: 'none'});
  const booleans = dialectWith({booleanType: 'supported'});

  test('a dialect with no boolean type spells both literals as conditions', () => {
    expect(noBooleans.sqlBoolean(true)).toBe('(1=1)');
    expect(noBooleans.sqlBoolean(false)).toBe('(1=0)');
  });

  test('a dialect with no boolean type spells a literal value as a bit', () => {
    expect(noBooleans.sqlBooleanValue(true)).toBe('1');
    expect(noBooleans.sqlBooleanValue(false)).toBe('0');
  });

  test('a dialect with booleans spells a literal the same in both forms', () => {
    expect(booleans.sqlBoolean(true)).toBe('true');
    expect(booleans.sqlBoolean(false)).toBe('false');
    expect(booleans.sqlBooleanValue(true)).toBe('true');
    expect(booleans.sqlBooleanValue(false)).toBe('false');
  });

  test('a dialect with no boolean type converts between the forms, NULL kept', () => {
    expect(noBooleans.sqlConditionAsValue('a > 1')).toBe(
      'CASE WHEN a > 1 THEN 1 WHEN NOT (a > 1) THEN 0 END'
    );
    expect(noBooleans.sqlValueAsCondition('v')).toBe('(v = 1)');
  });

  test('a dialect with booleans converts nothing', () => {
    expect(booleans.sqlConditionAsValue('a > 1')).toBe('a > 1');
    expect(booleans.sqlValueAsCondition('v')).toBe('v');
  });

  test('not, and a condition that is true when SQL says NULL', () => {
    expect(noBooleans.sqlNot('a > 1')).toBe(
      '(CASE WHEN a > 1 THEN 1 ELSE 0 END = 0)'
    );
    expect(noBooleans.sqlNullIsTrue('a <> 1')).toBe(
      '(CASE WHEN NOT (a <> 1) THEN 1 ELSE 0 END = 0)'
    );
    expect(booleans.sqlNot('a > 1')).toBe('COALESCE(NOT a > 1,TRUE)');
    expect(booleans.sqlNullIsTrue('a <> 1')).toBe('COALESCE(a <> 1,true)');
  });
});

describe('Dialect LIKE', () => {
  test('an extra wildcard is escaped through the ESCAPE clause', () => {
    const brackets = dialectWith({
      likeEscape: true,
      likeExtraWildcards: ['['],
      stringLiteralStyle: EscapeStyle.Doubled,
    });
    expect(brackets.sqlLike('LIKE', 'x', 'a[b%')).toBe(
      "x LIKE 'a^[b%' ESCAPE '^'"
    );
  });

  test('a dialect without extra wildcards passes the character through', () => {
    const plain = dialectWith({
      likeEscape: true,
      likeExtraWildcards: [],
      stringLiteralStyle: EscapeStyle.Doubled,
    });
    expect(plain.sqlLike('LIKE', 'x', 'a[b%')).toBe("x LIKE 'a[b%'");
  });
});
