/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '../../util/db-jest-matchers';
import {DateTime} from 'luxon';

const [describe] = describeIfDatabaseAvailable(['presto']);

describe('Presto tests', () => {
  const runtimeList = new RuntimeList(['presto']);
  const runtime = runtimeList.runtimeMap.get('presto');
  if (runtime === undefined) {
    throw new Error("Couldn't build runtime");
  }

  afterAll(async () => {
    await runtimeList.closeAll();
  });

  it('run an sql query', async () => {
    await expect(
      'run: presto.sql("SELECT 1 as n") -> { select: n }'
    ).malloyResultMatches(runtime, {n: 1});
  });

  // TODO: couldn't get this test to past locally, Presto in docker is giving me a value
  // of 1726138784, one hour different
  it('runs the to_unixtime function', async () => {
    await expect(`run: presto.sql("SELECT 1 as n") -> {
      select: x is to_unixtime(@2024-09-12 04:59:44)
      }`).malloyResultMatches(runtime, {x: 1726142384})
  });

  it('runs the arbitrary function', async () => {
    await expect(`run: presto.sql("SELECT 1 as n") -> {
      aggregate: x is arbitrary(n)
      }`).malloyResultMatches(runtime, {x: 1})
  });

  it('runs the date_format function', async () => {
    await expect(`run: presto.sql("SELECT 1 as n") -> {
      select: ts_string is date_format(@2024-09-12 15:42:33, '%Y-%m-%d %H:%i:%S')
      }`).malloyResultMatches(runtime, {ts_string: '2024-09-12 15:42:33'})
  });

  it('runs the date_parse function', async () => {

    const ts_obj = DateTime.fromObject(
      {
        year: 2024,
        month: 9,
        day: 15,
        hour: 0,
        minute: 0,
        second: 0,
      }
    );

    await expect(`run: presto.sql("SELECT 1 as n") -> {
      select: x is date_parse('2024-09-15', '%Y-%m-%d')
      }`).malloyResultMatches(runtime, {x: ts_obj})
  });

  // Failing test:  Expected {x: "2024-09-15T00:00:00.000-07:00"} Got: "2024-09-15T07:00:00.000Z"

  it('runs the regexp_replace function', async () => {
    await expect(`run: presto.sql("SELECT 1 as n") -> {
      select:
        remove_matches is regexp_replace('1a 2b 14m', '\\\\d+[ab] ')
        replace_matches is regexp_replace('1a 2b 14m', '(\\\\d+)([ab]) ', '3c$2 ')
      }`).malloyResultMatches(runtime, {remove_matches: '14m', replace_matches: '3ca 3cb 14m'})
  });

  it('runs the approx_percentile function', async () => {
    await expect(`run: presto.sql("""
      SELECT 1 as n
      UNION ALL SELECT 50 as n
      UNION ALL SELECT 100 as n
      """) -> {
      aggregate:
        default_pctl is approx_percentile(n, 0.5)
        pctl_with_error is approx_percentile(n, .99, 0.1)
      }`).malloyResultMatches(runtime, {default_pctl: 50, pctl_with_error: 100})
  });

  it('runs the bool_and function', async () => {
    await expect(`run: presto.sql("""
                SELECT true as n1, false as n2, false as n3
      UNION ALL SELECT true as n1, true as n2,  false as n3
      UNION ALL SELECT true as n1, false as n2, false as n3
      """) -> {
      aggregate:
        and_n1 is bool_and(n1)
        and_n2 is bool_and(n2)
        and_n3 is bool_and(n3)
      }`).malloyResultMatches(runtime, {
        and_n1: true,
        and_n2: false,
        and_n3: false,
      })
  });

  it('runs the bool_or function', async () => {
    await expect(`run: presto.sql("""
                SELECT true as n1, false as n2, false as n3
      UNION ALL SELECT true as n1, true as n2,  false as n3
      UNION ALL SELECT true as n1, false as n2, false as n3
      """) -> {
      aggregate:
        or_n1 is bool_or(n1)
        or_n2 is bool_or(n2)
        or_n3 is bool_or(n3)
      }`).malloyResultMatches(runtime, {
        or_n1: true,
        or_n2: true,
        or_n3: false,
      })
  });


});
