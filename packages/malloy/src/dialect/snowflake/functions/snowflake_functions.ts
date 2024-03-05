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
import {fnChr} from './chr';
import {fnDiv} from './div';
import {fnIsInf} from './is_inf';
import {fnIsNan} from './is_nan';
import {fnByteLength, fnLength} from './length';
import {fnLog} from './log';
import {fnRand} from './rand';
import {fnRegexpExtract} from './regexp_extract';
import {fnStartsWith, fnEndsWith} from './starts_ends_with';
import {fnStrpos} from './strpos';
import {fnTrunc} from './trunc';
import {fnStringAgg, fnStringAggDistinct} from './string_agg';

export const SNOWFLAKE_FUNCTIONS = FUNCTIONS.clone();
SNOWFLAKE_FUNCTIONS.add('byte_length', fnByteLength);
SNOWFLAKE_FUNCTIONS.add('chr', fnChr);
SNOWFLAKE_FUNCTIONS.add('div', fnDiv);
SNOWFLAKE_FUNCTIONS.add('is_inf', fnIsInf);
SNOWFLAKE_FUNCTIONS.add('is_nan', fnIsNan);
SNOWFLAKE_FUNCTIONS.add('length', fnLength);
SNOWFLAKE_FUNCTIONS.add('log', fnLog);
SNOWFLAKE_FUNCTIONS.add('rand', fnRand);
SNOWFLAKE_FUNCTIONS.add('regexp_extract', fnRegexpExtract);
SNOWFLAKE_FUNCTIONS.add('starts_with', fnStartsWith);
SNOWFLAKE_FUNCTIONS.add('ends_with', fnEndsWith);
SNOWFLAKE_FUNCTIONS.add('strpos', fnStrpos);
SNOWFLAKE_FUNCTIONS.add('trunc', fnTrunc);
SNOWFLAKE_FUNCTIONS.add('string_agg', fnStringAgg);
SNOWFLAKE_FUNCTIONS.add('string_agg_distinct', fnStringAggDistinct);
SNOWFLAKE_FUNCTIONS.seal();
