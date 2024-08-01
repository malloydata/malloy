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
  it(`number param used in dimension - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(param::number) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is param + 1
      }
      run: state_facts(param is 1) -> { group_by: param_plus_one }
    `).malloyResultMatches(runtime, {param_plus_one: 2});
  });
  it(`number param used in sql function - ${databaseName}`, async () => {
    await expect(`
      ##! experimental { parameters sql_functions }
      source: state_facts(param::number) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is sql_number("\${param} + 1")
      }
      run: state_facts(param is 1) -> { group_by: param_plus_one }
    `).malloyResultMatches(runtime, {param_plus_one: 2});
  });
  it.skip(`string param used in group_by - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(param::string) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is param
      }
      run: state_facts(param is "foo") -> { group_by: param_val is param }
    `).malloyResultMatches(runtime, {param_val: 'foo'});
  });
  it.skip(`reference field in source in argument - ${databaseName}`, async () => {
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

        join_many: state_facts is state_facts(state_filter) on 1 = 1
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
  // TODO excepting a field outright removes it from the source, without consideration
  //      to other fields that use that removed field in their definition; consider
  //      changing rename/accept/except to modify a mapping layer between the underlying
  //      source and the created source, as well as a separate way to override the definition
  //      of a field deeply (without removing it or changing its type).
  it.skip(`can use dimension that uses field that is excepted - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: state_facts is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: state_copy is state
        }
        source: state_facts_ext is state_facts extend {
          except: state
        }

        run: state_facts_ext -> {
          group_by: state_copy
          order_by: state_copy desc
          limit: 1
        }
      `
    ).malloyResultMatches(runtime, {state_copy: 'AK'});
  });
  it.skip(`can shadow field that is excepted, using dimension that uses field that is excepted - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: state_facts is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: state_copy is state
        }
        source: state_facts_hardcode_state(state::string) is state_facts extend {
          except: state
          dimension: hardcoded_state is state
        }

        run: state_facts_hardcode_state(state is 'NOT A STATE') -> {
          group_by: hardcoded_state, state_copy
          order_by: state_copy desc
          limit: 1
        }
      `
    ).malloyResultMatches(runtime, {
      hardcoded_state: 'NOT A STATE',
      state_copy: 'AK',
    });
  });
  it(`can shadow field that is excepted - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: state_facts is ${databaseName}.table('malloytest.state_facts')
        source: state_facts_hardcode_state(state::string) is state_facts extend {
          except: state
          dimension: hardcoded_state is state
        }

        run: state_facts_hardcode_state(state is 'NOT A STATE') -> {
          group_by: hardcoded_state
        }
      `
    ).malloyResultMatches(runtime, {hardcoded_state: 'NOT A STATE'});
  });
  it(`default value propagates - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: ab_new(param::number is 10) is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: param_value is param
        }
        run: ab_new -> { group_by: param_value }
      `
    ).malloyResultMatches(runtime, {param_value: 10});
  });
  it(`default value can be overridden - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: ab_new(param::number is 10) is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: param_value is param
        }
        run: ab_new(param is 11) -> { group_by: param_value }
      `
    ).malloyResultMatches(runtime, {param_value: 11});
  });
  it(`default value passed through extension propagates - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: ab_new(param::number is 10) is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: param_value is param
        }
        source: ab_new_new(param::number is 11) is ab_new(param) extend {}
        run: ab_new_new -> { group_by: param_value }
      `
    ).malloyResultMatches(runtime, {param_value: 11});
  });
  it(`use parameter in nested view - ${databaseName}`, async () => {
    await expect(
      `
        ##! experimental.parameters
        source: ab_new(param::number is 10) is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: param_value_1 is param
          view: v is {
            group_by: param_value_1
            group_by: param_value_2 is param
            nest: n is {
              group_by: param_value_1
              group_by: param_value_3 is param
            }
          }
        }
        run: ab_new -> v
      `
    ).malloyResultMatches(runtime, {
      'param_value_1': 10,
      'param_value_2': 10,
      'n.param_value_1': 10,
      'n.param_value_3': 10,
    });
  });
  it.skip(`can pass param into joined source from query - ${databaseName}`, async () => {
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

        join_many: state_facts is (state_facts(state_filter) -> { select: * }) on 1 = 1
      }

      run: state_facts2(state_filter is "CA") -> {
        group_by:
          s1 is state,
          s2 is state_facts.state
        aggregate: c is count()
      }
    `).malloyResultMatches(runtime, {s1: 'CA', s2: 'CA', c: 1});
  });
  it.skip(`can pass param into query definition - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts(
        state_filter::string
      ) is ${databaseName}.table('malloytest.state_facts') extend {
        where: state = state_filter
      }

      source: state_facts_query(state_filter::string) is state_facts(state_filter) -> { select: * }

      run: state_facts_query(state_filter is "CA") -> {
        select: state
      }
    `).malloyResultMatches(runtime, {state: 'CA'});
  });
  it(`can use param in join on - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts is ${databaseName}.table('malloytest.state_facts')

      source: state_facts2(
        state_filter::string
      ) is ${databaseName}.table('malloytest.state_facts') extend {
        where: state = state_filter

        join_many: state_facts on state_facts.state = state_filter
      }

      run: state_facts2(state_filter is "CA") -> {
        group_by:
          s1 is state,
          s2 is state_facts.state
        aggregate: c is count()
      }
    `).malloyResultMatches(runtime, {s1: 'CA', s2: 'CA', c: 1});
  });
  it(`can use param in join with - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: state_facts is ${databaseName}.table('malloytest.state_facts') extend {
        primary_key: state
      }

      source: state_facts2(
        state_filter::string
      ) is ${databaseName}.table('malloytest.state_facts') extend {
        where: state = state_filter

        join_one: state_facts with state_filter
      }

      run: state_facts2(state_filter is "CA") -> {
        group_by:
          s1 is state,
          s2 is state_facts.state
        aggregate: c is count()
      }
    `).malloyResultMatches(runtime, {s1: 'CA', s2: 'CA', c: 1});
  });
  it(`source arguments in query propagate when turned into source - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.parameters
      source: ab_new(param::number) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_value is param
      }
      query: foo is ab_new(param is 1) -> { select: param_value }
      source: foo_ext is foo
      run: foo_ext -> { select: param_value }
    `).malloyResultMatches(runtime, {param_value: 1});
  });
});
