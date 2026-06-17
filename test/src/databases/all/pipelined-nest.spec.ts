/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import '@malloydata/malloy/test/matchers';
import {databasesFromEnvironmentOr} from '../../util';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)(
  'pipelined nest %s',
  (databaseName, runtime) => {
    // Issue #2899: a nest whose pipeline is multi-stage with a projection
    // (`select:`) first stage generated a stage-combination that referenced the
    // query's final column names instead of the group-set-suffixed names the
    // prior CTE produced, and dropped the group_set column the final stage
    // needs. On Trino (no SELECT * REPLACE) that was invalid SQL
    // (`Column 'f1' cannot be resolved`); DuckDB inlines the pipeline and was
    // unaffected. Run it and check the nested data is actually produced.
    test.when(runtime.dialect.supportsPipelinesInViews)(
      `${databaseName} projection-first multi-stage nest`,
      async () => {
        const tm = wrapTestModel(runtime, '');
        await expect(`
          run: ${databaseName}.table('malloytest.state_facts') -> {
            group_by: first_letter is substr(state, 1, 1)
            order_by: first_letter
            nest: names is { select: state } -> {
              select: state
              order_by: state
            }
          }
        `).toMatchPaths(tm, {'names.state': 'AK'});
      }
    );
  }
);
