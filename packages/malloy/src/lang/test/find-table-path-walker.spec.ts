/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
