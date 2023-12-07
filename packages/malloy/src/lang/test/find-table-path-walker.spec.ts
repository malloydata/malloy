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

import {TestTranslator, markSource} from './test-translator';

test('Table path can be retrieved', () => {
  const source = markSource`
  source: flights is ${"DB.table('my.table.flights')"}
  source: flights2 is flights extend { dimension: a is astr }
`;
  const doc = new TestTranslator(source.code);
  const {pathInfo} = doc.tablePathInfo();
  expect(pathInfo?.length).toBe(1);
  expect(pathInfo![0].tablePath).toEqual('my.table.flights');
  expect(pathInfo![0].connectionId).toEqual('DB');
  expect(pathInfo![0].range).toEqual(source.locations[0].range);
});

test('Table path can not be retrieved', () => {
  const source = markSource`source: flights2 is flights extend { dimension: a is astr }`;
  const doc = new TestTranslator(source.code);
  const {pathInfo} = doc.tablePathInfo();
  expect(pathInfo?.length).toBe(0);
});

test('Table path can not be retrieved for non string path', () => {
  const source = markSource`source:  flights is duckdb.table("""foo.bar.baz%{foo}""")`;
  const doc = new TestTranslator(source.code);
  const {pathInfo} = doc.tablePathInfo();
  expect(pathInfo?.length).toBe(0);
});
