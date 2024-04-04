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

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

// No prebuilt shared model, each test is complete.  Makes debugging easier.
afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`basic index  - ${databaseName}`, async () => {
    const model = await runtime.loadModel(
      `
        source: airports is ${databaseName}.table('malloytest.airports') extend {
        }
    `
    );
    let result = await model.search('airports', 'SANTA', 10);

    // if (result !== undefined) {
    //   console.log(result);
    // } else {
    //   console.log("no result");
    // }
    expect(result).toBeDefined();
    if (result !== undefined) {
      expect(result[0].fieldName).toBe('county');
      expect(result[0].fieldValue).toBe('SANTA ROSA');
      expect(result[0].weight).toBe(26);
      expect(result.length).toBe(10);
    }

    result = await model.search('airports', 'SANTA A', 100, 'city');
    if (result !== undefined) {
      // console.log(result);
      expect(result[0].fieldName).toBe('city');
      expect(result[0].fieldValue).toBe('SANTA ANA');
    }
  });

  it(`index value map  - ${databaseName}`, async () => {
    const model = await runtime.loadModel(
      `
        source: airports is ${databaseName}.table('malloytest.airports') extend {
        }
    `
    );
    const result = await model.searchValueMap('airports');
    // if (result !== undefined) {
    //   console.log(result[4].values);
    // } else {
    //   console.log("no result");
    // }
    expect(result).toBeDefined();
    if (result !== undefined) {
      expect(result[4].values[0].fieldValue).toBe('WASHINGTON');
      expect(result[4].values[0].weight).toBe(214);
    }
  });

  it(`index no sample rows - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.state_facts') extend {
        dimension: one is 'one'
      } -> {index:one, state }
        -> {select: fieldName, weight, fieldValue; order_by: 2 desc; where: fieldName = 'one'}
    `).malloyResultMatches(runtime, {fieldName: 'one', weight: 51});
  });

  // bigquery doesn't support row count based sampling.
  test.when(databaseName !== 'bigquery')(
    `index rows count - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') extend {
          dimension: one is 'one'
        } -> {index:one, state; sample: 10 }
            -> {select: fieldName, weight, fieldValue; order_by: 2 desc; where: fieldName = 'one'}
      `).malloyResultMatches(runtime, {fieldName: 'one', weight: 10});
    }
  );

  it(`index rows count - ${databaseName}`, async () => {
    await expect(`
      run: ${databaseName}.table('malloytest.flights') extend {
        dimension: one is 'one'
      } -> {index:one, tail_num; sample: 50% }
        -> {select: fieldName, weight, fieldValue; order_by: 2 desc; where: fieldName = 'one'}
    `).malloyResultMatches(runtime, {fieldName: 'one'});
    // Hard to get consistent results here so just check that we get a value back.
  });

  // it(`fanned data index  - ${databaseName}`, async () => {
  //   const result = await runtime
  //     .loadModel(
  //       `
  //       source: movies is ${databaseName}.table('malloy-303216.imdb.movies') extend {
  //       }
  //   `
  //     )
  //     .search("movies", "Tom");
  //   // if (result !== undefined) {
  //   //   console.log(result);
  //   // } else {
  //   //   console.log("no result");
  //   // }
  //   expect(result).toBeDefined();
  //   if (result !== undefined) {
  //     expect(result[0].fieldName).toBe("county");
  //     expect(result[0].fieldValue).toBe("SANTA ROSA");
  //     expect(result[0].weight).toBe(26);
  //   }
  // });
});
