/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Dialect} from './dialect';

describe('Dialect booleans', () => {
  // Prototype-only instance: sqlBoolean reads only booleanType.
  const noBooleans = Object.create(Dialect.prototype) as Dialect;
  noBooleans.booleanType = 'none';

  test('a dialect with no boolean type spells both literals as conditions', () => {
    expect(noBooleans.sqlBoolean(true)).toBe('(1=1)');
    expect(noBooleans.sqlBoolean(false)).toBe('(1=0)');
  });
});

describe('Dialect ORDER BY and row limit', () => {
  const plain = Object.create(Dialect.prototype) as Dialect;

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
