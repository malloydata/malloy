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

import {FunctionDef} from '../..';
import {arg, func, overload, param, minScalar, maxAnalytic, sql} from './util';

export function fnRound(): FunctionDef {
  return func(
    'round',
    overload(
      minScalar('number'),
      [param('value', maxAnalytic('number'))],
      [sql('ROUND(', arg('value'), ')')]
    ),
    overload(
      minScalar('number'),
      [
        param('value', maxAnalytic('number')),
        // TODO this parameter should only accept integers, but we don't have a good
        // way of expressing that constraint at the moment
        param('precision', maxAnalytic('number')),
      ],
      [sql('ROUND(', arg('value'), ', ', arg('precision'), ')')]
    )
    // TODO Consider adding a third overload for round(x, y, mode), where
    // "mode" is "ROUND_HALF_AWAY_FROM_ZERO" or "ROUND_HALF_EVEN"
  );
}
