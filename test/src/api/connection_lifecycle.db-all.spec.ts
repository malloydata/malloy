/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

afterAll(() => testDatabase.shutdown());

describe('connection close test', () => {
  const n = testDatabase.dialect.sqlQuoteIdentifier('n');
  const testModel = wrapTestModel(testDatabase, '');
  test.each(Array.from({length: 50}, (_, i) => i + 1))(
    'run SELECT %i',
    async queryNum => {
      await expect(`
          run: db.sql("""SELECT ${queryNum} as ${n} """)
        `).toMatchResult(testModel, {n: queryNum});
    }
  );
});
