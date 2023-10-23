/* eslint-disable no-console */
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

import {runtimeFor} from './runtimes';
import './util/db-jest-matchers';

const runtime = runtimeFor('duckdb');

// uncomment out the skip if you want to play with the matchers
describe.skip('malloyResultMatches', () => {
  const sampleSource = `duckdb.sql("""
          SELECT 42 as num, 'whynot' as reason
          UNION ALL SELECT 49, 'because'""")`;

  const runtimeOrModel = runtime;

  test('simple', async () => {
    await expect(`
      run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, {num: 42, reason: 'whynot'});
  });

  test('nested', async () => {
    await expect(`
        run: ${sampleSource} -> {
            nest: the_nest is {
                select: nestNum is num, nestWhy is reasons
            }
        }
    `).malloyResultMatches(runtimeOrModel, {
      'the_nest.nestNum': 42,
      'theNest.nestWhy': 'whynot',
    });
  });

  test('multiple rows', async () => {
    await expect(`
        run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, [
      {num: 42, reason: 'whynot'},
      {num: 49, reason: 'because'},
    ]);
  });

  test('malloyResultMatches with an error', async () => {
    await expect(`
        rug: ${sampleSource}
    `).malloyResultMatches(runtime, [
      {num: 42, reason: 'whynot'},
      {num: 49, reason: 'because'},
    ]);
  });

  test('wrong data', async () => {
    await expect(`
      run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, {num: 24, reason: 'i said so'});
  });

  test('failing exactly one row', async () => {
    await expect(`
      run: ${sampleSource}
    `).malloyResultMatches(runtimeOrModel, [{}]);
  });
});
afterAll(async () => await runtime.connection.close());