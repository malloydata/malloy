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

import {ExpressionValueType} from '../../../model';
import {
  arg,
  overload,
  params,
  minScalar,
  anyExprType,
  sqlFragment,
  DialectFunctionOverloadDef,
  spread,
} from '../../functions/util';

const types: ExpressionValueType[] = [
  'string',
  'number',
  'timestamp',
  'date',
  'json',
];

function greatestOrLeast(
  fn: 'GREATEST' | 'LEAST'
): DialectFunctionOverloadDef[] {
  return types.map(type =>
    overload(
      minScalar(type),
      [params('values', anyExprType(type))],
      // TODO create a way for a function spec to map SQL to each arg before spreading, or something like that
      // Currently this SQL is pretty nasty, and we would rather write
      // CASE WHEN arg1 IS NULL OR arg2 is NULL ... OR argN is NULL THEN NULL ELSE GREATEST(arg1, arg2, ..., argN) END
      // But we can't do that with today's function spec.
      // That might look someday like
      /*
        sqlFragment(
          'CASE WHEN ',
          spread(map(arg('values'), '$ARG IS NULL'), ' OR '),
          `THEN NULL ELSE ${fn}(`,
          spread(arg('values')),
          ') END'
        ),
       */
      [
        sqlFragment(
          'CASE WHEN LIST_AGGREGATE(LIST_TRANSFORM([',
          spread(arg('values')),
          `], x -> CASE WHEN x IS NULL THEN 1 ELSE 0 END), 'sum') > 0 THEN NULL ELSE ${fn}(`,
          spread(arg('values')),
          ') END'
        ),
      ]
    )
  );
}

export const fnGreatest = () => greatestOrLeast('GREATEST');
export const fnLeast = () => greatestOrLeast('LEAST');
