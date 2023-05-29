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
  arg,
  overload,
  param,
  minScalar,
  anyExprType,
  sql,
  DialectFunctionOverloadDef,
  makeParam,
} from '../../functions/util';

export function fnTrunc(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', anyExprType('number'));
  const precision = makeParam('precision', anyExprType('number'));
  return [
    overload(
      minScalar('number'),
      [value.param],
      sql`CASE WHEN ${value.arg} < 0 THEN CEIL(${value.arg}) ELSE FLOOR(${value.arg}) END`
    ),
    overload(
      minScalar('number'),
      [value.param, precision.param],
      sql`CASE WHEN ${value.arg} < 0 THEN CEIL(${value.arg} * POW(10, ${precision.arg})) / POW(10, ${precision.arg}) ELSE FLOOR(${value.arg} * POW(10, ${precision.arg})) / POW(10, ${precision.arg}) END`
    ),
  ];
}
