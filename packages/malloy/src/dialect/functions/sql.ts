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
  DialectFunctionOverloadDef,
  makeParam,
  maxScalar,
  literal,
} from './util';

export function fnSqlNumber(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', literal(maxScalar('string')));
  return [
    overload(
      minScalar('number'),
      [value.param],
      [{type: 'sql-string', e: [value.arg]}]
    ),
  ];
}

export function fnSqlString(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', literal(maxScalar('string')));
  return [
    overload(
      minScalar('string'),
      [value.param],
      [{type: 'sql-string', e: [value.arg]}]
    ),
  ];
}

export function fnSqlDate(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', literal(maxScalar('string')));
  return [
    overload(
      minScalar('date'),
      [value.param],
      [{type: 'sql-string', e: [value.arg]}]
    ),
  ];
}

export function fnSqlTimestamp(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', literal(maxScalar('string')));
  return [
    overload(
      minScalar('timestamp'),
      [value.param],
      [{type: 'sql-string', e: [value.arg]}]
    ),
  ];
}

export function fnSqlBoolean(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', literal(maxScalar('string')));
  return [
    overload(
      minScalar('boolean'),
      [value.param],
      [{type: 'sql-string', e: [value.arg]}]
    ),
  ];
}
