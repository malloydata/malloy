/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */

import { RuntimeList } from '../../runtimes';
import { describeIfDatabaseAvailable } from '../../util';
import '../../util/db-jest-matchers';

const [describe, databases] = describeIfDatabaseAvailable(['snowflake']);
const runtimes = new RuntimeList(databases);
/**
Custom tests for Snowflake.  The HyperLogLog algorithm is approximate, and different database
implementations can return slighlty different results.  Thus we implement per-dialect unit tests
for these databases.
*/
describe.each(runtimes.runtimeList)(
  'Snowflake dialect functions - %s',

  (databaseName, runtime) => {
    if (runtime === undefined) {
      throw new Error("Couldn't build runtime");
    }
    it(`hyperloglog combine`, async () => {
      await expect(`run: bigquery.table('malloytest.airports')->{
          aggregate: code_hll is hll_accumulate(code)
      } -> {
          aggregate: code_count is hll_estimate(hll_combine(code_hll))
      }
      `).malloyResultMatches(runtime, { code_count: 19812 });
    });
  }
);
