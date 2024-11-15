/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`basic cube usage - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 })
      run: x -> { group_by: foo }
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it(`cube used in join - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 })
      source: y is ${databaseName}.table('malloytest.state_facts') extend {
        join_one: x on x.state = state
      }
      run: y -> { group_by: x.foo }
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it(`cube used in join on - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: state_copy is state })
      source: y is ${databaseName}.table('malloytest.state_facts') extend {
        // Join california by testing state copy;
        // cube usage is in join on, so the cube with state_copy should
        // be selected whenever this join is used
        join_one: ca is x on ca.state_copy = 'CA'
      }
      run: y -> { group_by: ca.state; where: state = 'IL' }
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  // TODO test always join cube usage
  it(`cube used in view - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is { group_by: foo }
      }
      run: x -> v
    `).malloyResultMatches(runtime, {foo: 1});
  });
  it(`cube used in view refined with scalar - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is {
          group_by: state
          where: state = 'CA'
          limit: 1
        }
      }
      run: x -> v + foo
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it(`cube used in view refined with literal view - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is {
          group_by: state
          where: state = 'CA'
          limit: 1
        }
      }
      run: x -> v + { group_by: foo }
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it(`cube used in refined query - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 }) extend {
        view: v is {
          group_by: state
          where: state = 'CA'
          limit: 1
        }
      }
      query: v is x -> v
      run: v + { group_by: foo }
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it(`cube of a cube - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(
        state_facts,
        state_facts extend { dimension: foo is 1 }
      )
      source: y is cube(
        x,
        x extend { dimension: bar is 2 }
      )
      // in order to get bar, we need to use the second cube input, which is itself a cube
      // then in order to get foo, we need to resolve the inner cube to its second input
      run: y -> { group_by: foo, bar }
    `).malloyResultMatches(runtime, {foo: 1, bar: 2});
  });
  it(`definitions from cube extension carry through - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(
        state_facts,
        state_facts extend { dimension: foo is 1 }
      ) extend {
        dimension: bar is 2
      }
      run: x -> { group_by: foo, bar }
    `).malloyResultMatches(runtime, {foo: 1, bar: 2});
  });
  it(`filters from cube extension carry through - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(
        state_facts,
        state_facts extend { dimension: foo is 1 }
      ) extend {
        where: state = 'CA'
      }
      run: x -> { group_by: foo, state }
    `).malloyResultMatches(runtime, {foo: 1, state: 'CA'});
  });
  it(`cube of a cube where greedy is bad- ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(
        cube(
          state_facts extend { dimension: foo is 1.1, bar is 2.1 },
          state_facts extend { dimension: foo is 1.2, baz is 3.2 }
        ),
        state_facts extend { dimension: foo is 1.3, bar is 2.3, baz is 3.3 }
      )
      // even though the first cube has all the fields foo, bar, baz; it is impossible
      // to resolve it using the first cube, because you can't have both bar and baz
      // so the second input source is used instead
      run: x -> { group_by: foo, bar, baz }
    `).malloyResultMatches(runtime, {foo: 1.3, bar: 2.3, baz: 3.3});
  });
  it(`cube with parameters - ${databaseName}`, async () => {
    await expect(`
      ##! experimental { cube_sources parameters }
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x(param is 1) is cube(
        state_facts extend { dimension: a is param },
        state_facts extend { dimension: b is param + 1 }
      )
      run: x(param is 2) -> { group_by: b }
    `).malloyResultMatches(runtime, {b: 3});
  });
});
