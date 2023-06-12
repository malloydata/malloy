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

import {MarkedSource, TestTranslator, markSource} from './test-translator';

function testHelpContext(
  source: MarkedSource,
  position: {line: number; character: number},
  type: 'explore_property' | 'query_property' | 'model_property',
  token: string
) {
  const doc = new TestTranslator(source.code);
  expect(doc.logger.hasErrors()).toBeFalsy();
  const helpContext = doc.helpContext(position).helpContext;
  expect(helpContext).toEqual({type, token});
}

const source = `source: foo is table('bar') {
  where: bazz ~ 'biff'
  query: foo is {
    group_by: bazz
    where: bop ~ 'blat'
  }
}

query: bar {
  group_by: bazz
}`;

test('Supports model properties', () => {
  testHelpContext(
    markSource`${source}`,
    {line: 0, character: 1},
    'model_property',
    'source:'
  );

  testHelpContext(
    markSource`${source}`,
    {line: 8, character: 1},
    'model_property',
    'query:'
  );
});

test('Supports source properties', () => {
  testHelpContext(
    markSource`${source}`,
    {line: 1, character: 3},
    'explore_property',
    'where:'
  );

  testHelpContext(
    markSource`${source}`,
    {line: 2, character: 3},
    'explore_property',
    'query:'
  );
});

test('Supports query properties', () => {
  testHelpContext(
    markSource`${source}`,
    {line: 3, character: 5},
    'query_property',
    'group_by:'
  );

  testHelpContext(
    markSource`${source}`,
    {line: 4, character: 5},
    'query_property',
    'where:'
  );
});
