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

import {fnConcat} from './concat';
import {fnTrunc} from './trunc';
import {fnStddev} from './stddev';
import {fnRound} from './round';
import {fnLower} from './lower';
import {fnChr, fnAscii, fnUnicode} from './chr';
import {fnUpper} from './upper';
import {fnSubstr} from './substr';
import {fnRegexpExtract} from './regexp_extract';
import {fnReplace} from './replace';
import {fnLength, fnByteLength} from './length';
import {fnIfnull} from './ifnull';
import {fnNullif} from './nullif';
import {fnRowNumber} from './row_number';
import {fnLag} from './lag';
import {fnLead} from './lead';
import {fnRank} from './rank';
import {fnFirstValueWindow, fnLastValueWindow} from './first_value_window';
import {
  fnMinWindow,
  fnMaxWindow,
  fnSumWindow,
  fnMinCumulative,
  fnMaxCumulative,
  fnSumCumulative,
} from './sum_min_max_window';
import {fnStartsWith, fnEndsWith} from './starts_ends_with';
import {fnIsInf} from './is_inf';
import {fnIsNan} from './is_nan';
import {fnAtan2} from './atan2';
import {fnPow} from './pow';
import {fnLog} from './log';
import {fnStrpos} from './strpos';
import {fnDiv} from './div';
import {fnGreatest, fnLeast} from './greatest_and_least';
import {fnTrim, fnLtrim, fnRtrim} from './trim_functions';
import {fnNumNulls, fnNumNonNulls} from './num_nulls_and_nonnulls';
import {fnRand} from './rand';
import {fnPi} from './pi';
import {fnRepeat} from './repeat';
import {fnReverse} from './reverse';
import {
  fnCos,
  fnAcos,
  fnSin,
  fnAsin,
  fnTan,
  fnAtan,
  fnAbs,
  fnSign,
  fnCeil,
  fnFloor,
  fnSqrt,
  fnLn,
  fnExp,
} from './simple_numeric_functions';
import {fnAvgRolling} from './avg_moving';
import {FunctionMap} from './function_map';
import {fnCoalesce} from './coalesce';

export const FUNCTIONS = new FunctionMap();

// Scalar functions
FUNCTIONS.add('concat', fnConcat);
FUNCTIONS.add('round', fnRound);
FUNCTIONS.add('trunc', fnTrunc);
FUNCTIONS.add('floor', fnFloor);
FUNCTIONS.add('ceil', fnCeil);
FUNCTIONS.add('cos', fnCos);
FUNCTIONS.add('acos', fnAcos);
FUNCTIONS.add('sin', fnSin);
FUNCTIONS.add('asin', fnAsin);
FUNCTIONS.add('tan', fnTan);
FUNCTIONS.add('atan', fnAtan);
FUNCTIONS.add('atan2', fnAtan2);
FUNCTIONS.add('lower', fnLower);
FUNCTIONS.add('upper', fnUpper);
FUNCTIONS.add('sqrt', fnSqrt);
FUNCTIONS.add('pow', fnPow);
FUNCTIONS.add('abs', fnAbs);
FUNCTIONS.add('sign', fnSign);
FUNCTIONS.add('is_inf', fnIsInf);
FUNCTIONS.add('is_nan', fnIsNan);
FUNCTIONS.add('greatest', fnGreatest);
FUNCTIONS.add('least', fnLeast);
FUNCTIONS.add('div', fnDiv);
FUNCTIONS.add('strpos', fnStrpos);
FUNCTIONS.add('starts_with', fnStartsWith);
FUNCTIONS.add('ends_with', fnEndsWith);
FUNCTIONS.add('trim', fnTrim);
FUNCTIONS.add('ltrim', fnLtrim);
FUNCTIONS.add('rtrim', fnRtrim);
FUNCTIONS.add('num_nulls', fnNumNulls);
FUNCTIONS.add('num_nonnulls', fnNumNonNulls);
FUNCTIONS.add('rand', fnRand);
FUNCTIONS.add('pi', fnPi);
FUNCTIONS.add('substr', fnSubstr);
FUNCTIONS.add('regexp_extract', fnRegexpExtract);
FUNCTIONS.add('replace', fnReplace);
FUNCTIONS.add('length', fnLength);
FUNCTIONS.add('byte_length', fnByteLength);
FUNCTIONS.add('ifnull', fnIfnull);
FUNCTIONS.add('coalesce', fnCoalesce);
FUNCTIONS.add('nullif', fnNullif);
FUNCTIONS.add('chr', fnChr);
FUNCTIONS.add('ascii', fnAscii);
FUNCTIONS.add('unicode', fnUnicode);
FUNCTIONS.add('repeat', fnRepeat);
FUNCTIONS.add('reverse', fnReverse);
FUNCTIONS.add('log', fnLog);
FUNCTIONS.add('ln', fnLn);
FUNCTIONS.add('exp', fnExp);

// Aggregate functions
FUNCTIONS.add('stddev', fnStddev);

// Analytic functions
FUNCTIONS.add('row_number', fnRowNumber);
FUNCTIONS.add('lag', fnLag);
FUNCTIONS.add('lead', fnLead);
FUNCTIONS.add('rank', fnRank);
FUNCTIONS.add('first_value', fnFirstValueWindow);
FUNCTIONS.add('last_value', fnLastValueWindow);
FUNCTIONS.add('min_cumulative', fnMinCumulative);
FUNCTIONS.add('max_cumulative', fnMaxCumulative);
FUNCTIONS.add('sum_cumulative', fnSumCumulative);
FUNCTIONS.add('min_window', fnMinWindow);
FUNCTIONS.add('max_window', fnMaxWindow);
FUNCTIONS.add('sum_window', fnSumWindow);
FUNCTIONS.add('avg_moving', fnAvgRolling);

FUNCTIONS.seal();
