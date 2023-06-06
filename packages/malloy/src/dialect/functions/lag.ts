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

import {ExpressionValueType} from '../..';
import {
  overload,
  sql,
  DialectFunctionOverloadDef,
  minAnalytic,
  maxAggregate,
  maxScalar,
  output,
  constant,
  makeParam,
  literal,
} from './util';

const types: ExpressionValueType[] = [
  'string',
  'number',
  'timestamp',
  'date',
  'json',
];

export function fnLag(): DialectFunctionOverloadDef[] {
  // TODO implement better "generics" -- an overload specifies names of types
  // and allowed types for that type name, then "params" and "returnType" can
  // refer to that named type...
  return types.flatMap(type => {
    const value = makeParam('value', output(maxAggregate(type)));
    const offset = makeParam('offset', literal(maxScalar('number')));
    const def = makeParam('default', constant(maxAggregate(type)));
    return [
      overload(minAnalytic(type), [value.param], sql`LAG(${value.arg})`, {
        needsWindowOrderBy: true,
      }),
      overload(
        minAnalytic(type),
        [value.param, offset.param],
        sql`LAG(${value.arg}, ${offset.arg})`,
        {needsWindowOrderBy: true}
      ),
      overload(
        minAnalytic(type),
        [value.param, offset.param, def.param],
        sql`LAG(${value.arg}, ${offset.arg}, ${def.arg})`,
        {needsWindowOrderBy: true}
      ),
    ];
  });
}
