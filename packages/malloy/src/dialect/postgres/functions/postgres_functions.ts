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
import {fnByteLength} from './byte_length';
import {fnGreatest, fnLeast} from './greatest_and_least';
import {fnIsInf} from './is_inf';
import {fnIsNan} from './is_nan';
import {fnRand} from './rand';
import {fnRegexpExtract} from './regexp_extract';
import {fnRound} from './round';
import {fnStddev} from './stddev';

export const POSTGRES_FUNCTIONS = FUNCTIONS.clone();
POSTGRES_FUNCTIONS.add('regexp_extract', fnRegexpExtract);
POSTGRES_FUNCTIONS.add('stddev', fnStddev);
POSTGRES_FUNCTIONS.add('rand', fnRand);
POSTGRES_FUNCTIONS.add('greatest', fnGreatest);
POSTGRES_FUNCTIONS.add('least', fnLeast);
POSTGRES_FUNCTIONS.add('is_nan', fnIsNan);
POSTGRES_FUNCTIONS.add('is_inf', fnIsInf);
POSTGRES_FUNCTIONS.add('round', fnRound);
POSTGRES_FUNCTIONS.add('byte_length', fnByteLength);
POSTGRES_FUNCTIONS.seal();
