/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

it('raw query as head works', async () => {
  await expect(
    `
        query: q is db.sql("SELECT 1 as one")
        run: q -> { group_by: one }
      `
  ).toMatchResult(testModel, {one: 1});
  await expect(
    `
        query: q is db.sql("SELECT 1 as one")
        query: q2 is q -> { group_by: one }
        run: q2 -> { select: one }
      `
  ).toMatchResult(testModel, {one: 1});
  await expect(
    `
        query: q is db.sql("SELECT 1 as one") -> { group_by: two is one + 1 }
        run: q -> { group_by: two }
      `
  ).toMatchResult(testModel, {two: 2});
  await expect(
    `
        query: q is db.sql("SELECT 1 as one") -> { group_by: two is one + 1 }
        run: q
      `
  ).toMatchResult(testModel, {two: 2});
});
