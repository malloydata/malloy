/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

// A nest is a column whose value is the result of a query. What that column
// contains, and in what order, is the subject here.
//
// The order is the order of the stage which produced it -- the order the user
// asked for, or the one Malloy picked. Reading the array back is the only way to
// see that, and the ordering is attached to the SQL which packs the array, which
// is a different expression for a one-stage nest than for a pipelined one.
//
// The ordering tests nest over the four 'N' states whose popular_name is
// Isabella, because their four candidate orderings are all distinct:
//   state desc    NY NV NM NJ
//   state asc     NJ NM NV NY
//   births desc   NY NJ NM NV
//   births asc    NV NM NJ NY
// A pipelined test orders its first stage the opposite way from its last, so an
// array carrying the wrong stage's order fails instead of coincidentally passing.

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const model = wrapTestModel(
    runtime,
    `
    query: isabellaN is ${databaseName}.table('malloytest.state_facts') -> {
      where: popular_name = 'Isabella' and state ~ 'N%'
      group_by: popular_name
    }`
  );

  const stateDesc = [{st: 'NY'}, {st: 'NV'}, {st: 'NM'}, {st: 'NJ'}];
  const birthsDesc = [{st: 'NY'}, {st: 'NJ'}, {st: 'NM'}, {st: 'NV'}];
  const keywordStateDesc = [
    {'select': 'NY'},
    {'select': 'NV'},
    {'select': 'NM'},
    {'select': 'NJ'},
  ];

  test.when(runtime.supportsNesting)(
    `one-stage nest is in the order it asked for - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st desc
          }
        }`).toMatchResult(model, {n: stateDesc});
    }
  );

  test.when(runtime.supportsNesting)(
    `one-stage nest orders by a name which needs quoting - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: \`select\` is state
            aggregate: b is births.sum()
            order_by: \`select\` desc
          }
        }`).toMatchResult(model, {n: keywordStateDesc});
    }
  );

  test.when(runtime.supportsNesting)(
    `one-stage nest with no order_by is largest first - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
          }
        }`).toMatchResult(model, {n: birthsDesc});
    }
  );

  // Trino packs a pipelined nest's array without the ordering of the stage which
  // produced it, so the array arrives in the first stage's order instead.
  const pipelinedNestIsOrdered =
    runtime.dialect.supportsPipelinesInViews && databaseName !== 'trino';

  test.when(pipelinedNestIsOrdered)(
    `pipelined nest is in the order its last stage asked for - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st asc
          } -> {
            group_by: st, b
            order_by: st desc
          }
        }`).toMatchResult(model, {n: stateDesc});
    }
  );

  test.when(pipelinedNestIsOrdered)(
    `pipelined nest orders by a name which needs quoting - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: \`select\` is state
            aggregate: b is births.sum()
            order_by: \`select\` asc
          } -> {
            group_by: \`select\`, b
            order_by: \`select\` desc
          }
        }`).toMatchResult(model, {n: keywordStateDesc});
    }
  );

  // An ordinal order_by names an output field by number, counting from one.
  test.when(runtime.supportsNesting)(
    `one-stage nest orders by an output field number - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: 1 desc
          }
        }`).toMatchResult(model, {n: stateDesc});
    }
  );

  test.when(pipelinedNestIsOrdered)(
    `pipelined nest orders by an output field number - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st asc
          } -> {
            group_by: st, b
            order_by: 1 desc
          }
        }`).toMatchResult(model, {n: stateDesc});
    }
  );

  test.when(pipelinedNestIsOrdered)(
    `pipelined nest ending in select orders by an output field number - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
            order_by: st asc
          } -> {
            select: st, b
            order_by: 2 desc
          }
        }`).toMatchResult(model, {n: birthsDesc});
    }
  );

  test.when(runtime.dialect.supportsPipelinesInViews)(
    `pipelined nest with no order_by is largest first - ${databaseName}`,
    async () => {
      await expect(`
        run: isabellaN + {
          nest: n is {
            group_by: st is state
            aggregate: b is births.sum()
          } -> {
            group_by: st
            aggregate: tot is b.sum()
          }
        }`).toMatchResult(model, {n: birthsDesc});
    }
  );

  test.when(runtime.supportsNesting)(
    `an aggregate which is null in a nest reads back as null - ${databaseName}`,
    async () => {
      await expect(`
        run: ${databaseName}.table('malloytest.state_facts') -> {
          group_by: state
          nest: ugly is {
            group_by: popular_name
            aggregate: foo is NULLIF(sum(airport_count)*0,0)+1
          }
        }`).toMatchPaths(model, {'ugly.foo': null});
    }
  );

  // A null value in the grouping above a nest must not null out the nest.
  test.when(runtime.supportsNesting)(
    `a nest under a null group is still a nest - ${databaseName}`,
    async () => {
      const result = await runtime
        .loadQuery(
          `
        run: ${databaseName}.table('malloytest.airports') -> {
          where: faa_region is null
          group_by: faa_region
          aggregate: airport_count is count()
          nest: by_state is {
            where: state is not null
            group_by: state
            aggregate: airport_count is count()
          }
          nest: capped is {
            where: state is not null
            group_by: state
            aggregate: airport_count is count()
            limit: 1
          }
        }`
        )
        .run();
      const row = result.data.toObject()[0] as Record<string, unknown>;
      expect(row['by_state']).not.toBe(null);
      expect(row['capped']).not.toBe(null);
    }
  );
});
