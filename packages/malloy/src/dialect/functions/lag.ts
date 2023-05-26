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
  arg,
  overload,
  param,
  sql,
  DialectFunctionOverloadDef,
  minAnalytic,
  maxAggregate,
  maxScalar,
  output,
  constant,
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
  return types.flatMap(type => [
    overload(
      minAnalytic(type),
      [param('value', output(maxAggregate(type)))],
      sql`LAG(${arg('value')})`,
      {needsWindowOrderBy: true}
    ),
    overload(
      minAnalytic(type),
      [
        param('value', output(maxAggregate(type))),
        param('offset', constant(maxScalar('number'))),
      ],
      sql`LAG(${arg('value')}, ${arg('offset')})`,
      {needsWindowOrderBy: true}
    ),
    overload(
      minAnalytic(type),
      [
        param('value', output(maxAggregate(type))),
        param('offset', constant(maxScalar('number'))),
        // TODO In BigQuery I think this is even a stronger limitation
        // that it needs to be a CONSTANT, not just a scalar.
        // DuckDB has no problem with this being even an aggregate
        param('default', constant(maxAggregate(type))),
      ],
      sql`LAG(${arg('value')}, ${arg('offset')}, ${arg('default')})`,
      {needsWindowOrderBy: true}
    ),
  ]);
}
