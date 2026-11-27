/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Runtime} from '@malloydata/malloy';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

import {testDatabase} from '../test_database';

describe('Postgres tests', () => {
  const testModel = wrapTestModel(testDatabase, '');

  // Idempotently create schema and tables with capital letters to use in tests.
  beforeAll(async () => {
    const connection = await testDatabase.connection();
    await connection.runSQL('create schema if not exists "UpperSchema";');
    await Promise.all([
      connection.runSQL(
        'create table if not exists "UpperSchema"."UpperSchemaUpperTable" as select 1 as one;'
      ),
      connection.runSQL(
        'create table if not exists "UpperTablePublic" as select 1 as one;'
      ),
    ]);
  });

  afterAll(() => testDatabase.shutdown());

  async function oneExists(rt: Runtime, tn: string): Promise<boolean> {
    try {
      const lookForOne = await rt
        .loadQuery(`run: db.sql('SELECT one FROM ${tn}')`)
        .run();
      const one = lookForOne.data.path(0, 'one').value;
      return one === 1;
    } catch (e) {
      return false;
    }
  }

  it('mixed case col names are properly quoted so they retain case in results', async () => {
    await expect(`
      run: db.sql('SELECT 1 as "upperLower"') -> { select: upperLower }
    `).toMatchResult(testModel, {upperLower: 1});
  });

  it('user quoting works for mixed case table name', async () => {
    if (await oneExists(testDatabase.runtime, 'public."UpperTablePublic"')) {
      await expect(`
        run: db.table('public."UpperTablePublic"') -> { select: one }
      `).toMatchResult(testModel, {one: 1});
    }
  });

  it('user quoting works for mixed case schema name', async () => {
    if (
      await oneExists(
        testDatabase.runtime,
        '"UpperSchema"."UpperSchemaUpperTable"'
      )
    ) {
      await expect(`
        run: db.table('"UpperSchema"."UpperSchemaUpperTable"') -> { select: one }
      `).toMatchResult(testModel, {one: 1});
    }
  });
});
