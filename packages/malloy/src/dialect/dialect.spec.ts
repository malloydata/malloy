/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MySQLDialect} from './mysql';
import {SQLServerDialect} from './sqlserver';

describe('Dialect booleans', () => {
  test('a dialect with no boolean type spells both literals as conditions', () => {
    const noBooleans = new SQLServerDialect();
    expect(noBooleans.sqlBoolean(true)).toBe('(1=1)');
    expect(noBooleans.sqlBoolean(false)).toBe('(1=0)');
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
