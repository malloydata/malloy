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
