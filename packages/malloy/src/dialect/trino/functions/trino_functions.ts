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

import {FUNCTIONS} from '../../functions';
import {fnTrunc} from './trunc';
import {fnLog} from './log';
import {fnIfnull} from './ifnull';
import {fnConcat} from './concat';
import {fnByteLength} from './byte_length';
import {fnStringAgg, fnStringAggDistinct} from './string_agg';

export const TRINO_FUNCTIONS = FUNCTIONS.clone();
TRINO_FUNCTIONS.add('trunc', fnTrunc);
TRINO_FUNCTIONS.add('log', fnLog);
TRINO_FUNCTIONS.add('ifnull', fnIfnull);
TRINO_FUNCTIONS.add('byte_length', fnByteLength);
TRINO_FUNCTIONS.add('concat', fnConcat);
TRINO_FUNCTIONS.add('string_agg', fnStringAgg);
TRINO_FUNCTIONS.add('string_agg_distinct', fnStringAggDistinct);
TRINO_FUNCTIONS.seal();
