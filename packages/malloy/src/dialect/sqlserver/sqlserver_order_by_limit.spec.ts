/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SQLServerDialect} from './sqlserver';

// A row limit is an extension of ORDER BY, and an ORDER BY carrying OFFSET is
// legal inside a CTE, so the same clause ends every stage.
describe('sqlserver ORDER BY and row limit', () => {
  const d = new SQLServerDialect();

  test('terms and a limit', () => {
    expect(d.sqlOrderByLimit(['"n" DESC'], 5)).toBe(
      'ORDER BY "n" DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY\n'
    );
  });

  test('terms without a limit still carry an OFFSET', () => {
    expect(d.sqlOrderByLimit(['"n" DESC', '"state" ASC'], undefined)).toBe(
      'ORDER BY "n" DESC,"state" ASC OFFSET 0 ROWS\n'
    );
  });

  test('a limit without terms orders by a constant subquery', () => {
    expect(d.sqlOrderByLimit([], 3)).toBe(
      'ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY\n'
    );
  });

  test('neither writes nothing', () => {
    expect(d.sqlOrderByLimit([], undefined)).toBe('');
  });
});
