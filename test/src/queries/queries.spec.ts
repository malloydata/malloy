/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

describe('misc tests for regressions that have no better home', () => {
  test('ambiguous output names are auto-renamed and runnable', async () => {
    // `state` and `s2.state` both want the name `state`; the second is renamed
    // to `s2_state`. The query must compile to runnable SQL. (Small table with
    // a 1:1 self-join, so the query stays cheap.)
    const query = testDatabase.runtime.loadQuery(`
      run: db.table('malloytest.state_facts') extend {
        join_one: s2 is db.table('malloytest.state_facts') on state = s2.state
      } -> { group_by: state, s2.state; limit: 1 }
    `);
    const result = await query.run();
    const schema = result.resultExplore;
    expect(schema.getFieldByName('state')).toBeDefined();
    expect(schema.getFieldByName('s2_state')).toBeDefined();
  });
});
