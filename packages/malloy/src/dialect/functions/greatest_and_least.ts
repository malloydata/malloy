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
  params,
  minScalar,
  anyExprType,
  sqlFragment,
  DialectFunctionOverloadDef,
  spread,
} from './util';

const types: ExpressionValueType[] = [
  'string',
  'number',
  'timestamp',
  'date',
  'json',
];

// TODO Flip this around so that in DuckDB and Postgres, it just calls the function
// directly, and in BigQuery we add a wrapper to ensure that the null behavior is consistent.
// It should be that nulls are ignored, rather than propagated.
function greatestOrLeast(
  fn: 'GREATEST' | 'LEAST'
): DialectFunctionOverloadDef[] {
  return types.map(type =>
    overload(
      minScalar(type),
      [params('values', anyExprType(type))],
      [sqlFragment(`${fn}(`, spread(arg('values')), ')')]
    )
  );
}

export const fnGreatest = () => greatestOrLeast('GREATEST');
export const fnLeast = () => greatestOrLeast('LEAST');
