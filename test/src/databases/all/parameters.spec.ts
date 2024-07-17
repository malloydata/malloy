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
      source: state_facts(param::number) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is param + 1
      }
      run: state_facts(param is 1) -> { group_by: param_plus_one }
    `).malloyResultMatches(runtime, {param_plus_one: 2});
  });
  it(`string param used in group_by - ${databaseName}`, async () => {
    await expect(`
      source: state_facts(param::string) is ${databaseName}.table('malloytest.state_facts') extend {
        dimension: param_plus_one is param
      }
      run: state_facts(param is "foo") -> { group_by: param_val is param }
    `).malloyResultMatches(runtime, {param_val: 'foo'});
  });
  it.todo('can pass param into joined source correctly');
});
