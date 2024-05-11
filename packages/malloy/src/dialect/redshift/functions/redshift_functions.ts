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
import {fnStringAgg, fnStringAggDistinct} from './string_agg';
import {fnByteLength} from './byte_length';
import {fnEndsWith} from './ends_with';
import {fnGreatest, fnLeast} from './greatest_and_least';
import {fnIfnull} from './ifnull';
import {fnIsInf} from './is_inf';
import {fnIsNan} from './is_nan';
import {fnLog} from './log';
import {fnRand} from './rand';
import {fnRegexpExtract} from './regexp_extract';
import {fnReplace} from './replace';
import {fnRound} from './round';
import {fnStddev} from './stddev';
import {fnSubstr} from './substr';
import {fnTrunc} from './trunc';
import {fnUnicode} from './unicode';

export const REDSHIFT_FUNCTIONS = FUNCTIONS.clone();
REDSHIFT_FUNCTIONS.add('regexp_extract', fnRegexpExtract);
REDSHIFT_FUNCTIONS.add('stddev', fnStddev);
REDSHIFT_FUNCTIONS.add('rand', fnRand);
REDSHIFT_FUNCTIONS.add('greatest', fnGreatest);
REDSHIFT_FUNCTIONS.add('least', fnLeast);
REDSHIFT_FUNCTIONS.add('is_nan', fnIsNan);
REDSHIFT_FUNCTIONS.add('is_inf', fnIsInf);
REDSHIFT_FUNCTIONS.add('round', fnRound);
REDSHIFT_FUNCTIONS.add('byte_length', fnByteLength);
REDSHIFT_FUNCTIONS.add('unicode', fnUnicode);
REDSHIFT_FUNCTIONS.add('ifnull', fnIfnull);
REDSHIFT_FUNCTIONS.add('trunc', fnTrunc);
REDSHIFT_FUNCTIONS.add('substr', fnSubstr);
REDSHIFT_FUNCTIONS.add('replace', fnReplace);
REDSHIFT_FUNCTIONS.add('ends_with', fnEndsWith);
REDSHIFT_FUNCTIONS.add('string_agg', fnStringAgg);
REDSHIFT_FUNCTIONS.add('string_agg_distinct', fnStringAggDistinct);
REDSHIFT_FUNCTIONS.add('log', fnLog);
REDSHIFT_FUNCTIONS.seal();
