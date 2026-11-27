/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DateTime} from 'luxon';

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

describe('time oddities', () => {
  const zone = 'America/Mexico_City'; // -06:00 no DST
  const zone_2020 = DateTime.fromObject(
    {year: 2020, month: 2, day: 20, hour: 0, minute: 0, second: 0},
    {zone}
  );

  test('can cast TIMESTAMPTZ to timestamp', async () => {
    await expect(`
        run: db.sql("""
              SELECT TIMESTAMPTZ '2020-02-20 00:00:00 ${zone}' as t_tstz
          """) -> {
            select: mex_220 is t_tstz::timestamp
          }`).toMatchResult(testModel, {mex_220: zone_2020.toJSDate()});
  });
});
