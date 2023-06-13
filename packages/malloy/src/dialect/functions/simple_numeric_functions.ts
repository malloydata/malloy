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
  DialectFunctionOverloadDef,
  sqlFragment,
} from './util';

export function simple(fn: string): DialectFunctionOverloadDef[] {
  return [
    overload(
      minScalar('number'),
      [param('value', anyExprType('number'))],
      [sqlFragment(`${fn}(`, arg('value'), ')')]
    ),
  ];
}

// Trig functions
export const fnCos = () => simple('COS');
export const fnAcos = () => simple('ACOS');
export const fnSin = () => simple('SIN');
export const fnAsin = () => simple('ASIN');
export const fnTan = () => simple('TAN');
export const fnAtan = () => simple('ATAN');

export const fnSign = () => simple('SIGN');
export const fnCeil = () => simple('CEIL');
export const fnFloor = () => simple('FLOOR');
export const fnAbs = () => simple('ABS');
export const fnSqrt = () => simple('SQRT');
export const fnLn = () => simple('LN');
export const fnExp = () => simple('EXP');
