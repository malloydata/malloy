/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

// // No prebuilt shared model, each test is complete.  Makes debugging easier.
// function rootDbPath(databaseName: string) {
//   return databaseName === 'bigquery' ? 'malloydata-org.' : '';
// }

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  // const q = runtime.getQuoter();

  describe('limits', () => {
    test('limit only', async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: c is count()
        limit: 3
      }
      `).malloyResultMatches(runtime, [{}, {}, {}]);
    });

    test('limit nest one', async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: c is count()
        limit: 3
        nest: one is {
          group_by: state
          limit: 2
        }
      }
      `).malloyResultMatches(runtime, [
        {popular_name: 'Isabella', one: [{'state': 'AZ'}, {}]},
        {},
        {},
      ]);
    });

    test('limit nest with having', async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: c is count()
        having: c % 2 = 1
        limit: 3
        nest: one is {
          group_by: state
          limit: 2
        }
      }
      `).malloyResultMatches(runtime, [
        {popular_name: 'Sophia', one: [{'state': 'AK'}, {}]},
        {},
        {},
      ]);
    });

    test('limit two nests with having', async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        nest: name is {
          group_by: popular_name
          aggregate: c is count()
          having: c % 2 = 1
          limit: 3
        }
        nest: by_state is {
          group_by: state
          limit: 2
        }
      }
      `).malloyResultMatches(runtime, [
        {
          'name': [{popular_name: 'Sophia'}, {}, {}],
          'by_state': [{'state': 'AK'}, {}],
        },
      ]);
    });

    test('limit 2 stage second with nest with having', async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts') -> {
        select: *
      } -> {
        group_by: popular_name
        aggregate: c is count()
        having: c % 2 = 1
        limit: 3
        nest: one is {
          group_by: state
          limit: 2
        }
      }
      `).malloyResultMatches(runtime, [
        {popular_name: 'Sophia', one: [{'state': 'AK'}, {}]},
        {},
        {},
      ]);
    });

    test('limit index 2 stage', async () => {
      await expect(`
      //# test.debug
      run: ${databaseName}.table('malloytest.state_facts') -> {
        index: *
      } -> {
        group_by: fieldName
        aggregate: cardinality is count(fieldValue)
        limit: 2
        nest: values is {
          group_by: fieldValue
          aggregate: weight is weight.sum()
          limit: 3
        }
      }
      `).malloyResultMatches(runtime, [
        {fieldName: 'state', values: [{}, {}, {}]},
        {
          fieldName: 'popular_name',
          values: [{fieldValue: 'Isabella', weight: 24}, {}, {}],
        },
      ]);
    });
    test('limit select - in pipeline', async () => {
      await expect(`
      //# test.debug
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: c is count()
        having: c % 2 = 1
        limit: 100
        nest: one is {
          group_by: state
          limit: 2
        }
      } -> {
        select: popular_name
        limit: 2
      }
      `).malloyResultMatches(runtime, [{}, {}]);
    });

    test.when(
      runtime.supportsNesting &&
        runtime.dialect.supportsPipelinesInViews &&
        databaseName !== 'trino'
    )('limit select - nested pipeline', async () => {
      await expect(`
      //# test.debug
      run: ${databaseName}.table('malloytest.state_facts') -> {
        group_by: popular_name
        aggregate: c is count()
        having: c % 2 = 1
        limit: 1
        nest: one is {
          group_by: state
          limit: 20
        } -> {
          select: state
          limit: 2
        }
      }
      `).malloyResultMatches(runtime, [{one: [{}, {}]}]);
    });
  });
});
