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

export function fnChr(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', anyExprType('number'));
  return [
    overload(
      minScalar('string'),
      [value.param],
      // Need to explicitly have a case for when the arg is 0, to return ''
      // Also, cannot compare literal null with = in BigQuery, so we wrap in an IFNULL
      sql`CASE WHEN IFNULL(${value.arg}, 1) = 0 THEN '' ELSE CHR(${value.arg}) END`
    ),
  ];
}
