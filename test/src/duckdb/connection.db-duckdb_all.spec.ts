/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

// This test changes its connection's time zone, so it is alone in its file:
// each file has its own connection.
it('supports timezones', async () => {
  const connection = await testDatabase.connection();
  await connection.runSQL("SET TimeZone='CET'");
  const result = await connection.runSQL("SELECT current_setting('TimeZone')");
  expect(result.rows[0]).toEqual({"current_setting('TimeZone')": 'CET'});
});
