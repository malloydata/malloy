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

export function fnReplace(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', anyExprType('string'));
  const stringPattern = makeParam('pattern', anyExprType('string'));
  const regexPattern = makeParam('pattern', anyExprType('regular expression'));
  const replacement = makeParam('replacement', anyExprType('string'));
  return [
    overload(
      minScalar('string'),
      [value.param, stringPattern.param, replacement.param],
      sql`REPLACE(${value.arg}, ${stringPattern.arg}, ${replacement.arg})`
    ),
    overload(
      minScalar('string'),
      [value.param, regexPattern.param, replacement.param],
      // In Postgres we need to specifically say that it's a global replacement.
      sql`REGEXP_REPLACE(${value.arg}, ${regexPattern.arg}, ${replacement.arg}, 'g')`
    ),
  ];
}
