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

// Must import Jest functions directly because tsc detects Jasmine globals for Karma otherwise
import {describe, expect, it} from '@jest/globals';
import {generateTextmateTokenizations} from '../../test/generateTextmateTokenizations';
import expectedTokenizations from './tokenizations/darkPlus';
import testConfig from '../../test/config/textmate/malloyDarkPlusConfig';
import {TestItem} from '../../test/testUtils';

let actualTokenizations: TestItem[][];

beforeAll(async () => {
  actualTokenizations = await generateTextmateTokenizations(testConfig);
});
describe('malloy', () => {
  for (let i = 0; i < testConfig.testInput.length; i++) {
    const block = testConfig.testInput[i].map(line => `\t"${line}"`).join('\n');
    it(`correctly tokenizes\n${block}\n\twith correct colors`, () => {
      expect(actualTokenizations[i]).toEqual(expectedTokenizations[i]);
    });
  }
});
