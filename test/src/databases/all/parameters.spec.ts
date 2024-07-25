/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

// const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));
const runtimes = new RuntimeList(databasesFromEnvironmentOr(['duckdb']));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`number param used in dimension - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(param::number) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is param + 1
      }
      run: state_facts(param is 1) -> { group_by: param_plus_one }
    `).malloyResultMatches(runtime, {param_plus_one: 2});
  });
  it(`string param used in group_by - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(param::string) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is param
      }
      run: state_facts(param is "foo") -> { group_by: param_val is param }
    `).malloyResultMatches(runtime, {param_val: 'foo'});
  });
  it(`reference field in source in argument - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(filter::boolean) is ${databaseName}.table('malloytest.state_facts') extend {
        where: filter
      }
      run: state_facts(filter is state = 'CA') -> { group_by: state }
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  it(`can pass param into joined source correctly - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(
        state_filter::string
      ) is ${databaseName}.table('malloytest.state_facts') extend {
        where: state = state_filter
      }

      source: state_facts2(
        state_filter::string
      ) is ${databaseName}.table('malloytest.state_facts') extend {
        where: state = state_filter

        join_many: state_facts is state_facts(
          state_filter is state_filter
        ) on 1 = 1
      }

      run: state_facts2(state_filter is "CA") -> {
        group_by:
          s1 is state,
          s2 is state_facts.state
        aggregate: c is count()
      }
    `).malloyResultMatches(runtime, {s1: 'CA', s2: 'CA', c: 1});
  });

  it(`can pass param into extended source - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(param::number) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: p is param
      }
      source: state_facts_ext(param::number) is state_facts(param)
      run: state_facts_ext(param is 1) -> p
    `).malloyResultMatches(runtime, {p: 1});
  });
});
