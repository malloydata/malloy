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

// Note the use of .js extensions for imports (not necessary for type imports)
// to run the test with Karma
import {
  loadMonacoAssets,
  generateMonarchTokenizations,
} from '../../test/generateMonarchTokenizations.js';
import {malloyDarkPlusConfig as testConfig} from '../../test/config/monaco/malloyDarkPlusConfig.js';
import {TestItem, monarchTestMatchers} from '../../test/testUtils.js';

let actualTokenizations: TestItem[][];

beforeAll(async () => {
  await loadMonacoAssets();
  // The call to loadMonacoAssets makes the monaco global accessible in Karma Chrome tests
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  actualTokenizations = generateMonarchTokenizations(monaco, testConfig);
  jasmine.addMatchers(monarchTestMatchers);
});
describe(testConfig.language.id, () => {
  for (let i = 0; i < testConfig.expectations.length; i++) {
    describe(`tokenizes block #${i}`, () => {
      for (let j = 0; j < testConfig.expectations[i].length; j++) {
        it(`tokenizes line "${testConfig.expectations[i][j].line}"`, () => {
          const actual = actualTokenizations[i][j];
          const expected = testConfig.expectations[i][j];
          expect(actual).toMatchColorData(expected);
        });
      }
    });
  }
});
