/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  overload,
  minScalar,
  anyExprType,
  sql,
  DialectFunctionOverloadDef,
  makeParam,
} from '../../functions/util';

export function fnTrunc(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', anyExprType('number'));
  const precision = makeParam('precision', anyExprType('number'));
  // Postgres doesn't let you TRUNC a FLOAT with a precision, so we cast to NUMERIC first
  // Also, TRUNC(NULL) doesn't compile because PG doesn't know the type of NULL, so we cast to
  // NUMERIC there too...
  // TODO Maybe there's a way we don't have to cast to NUMERIC.
  return [
    overload(
      minScalar('number'),
      [value.param],
      sql`TRUNC(${value.arg}::NUMERIC)`
    ),
    overload(
      minScalar('number'),
      [value.param, precision.param],
      sql`TRUNC((${value.arg}::NUMERIC), ${precision.arg})`
    ),
  ];
}
