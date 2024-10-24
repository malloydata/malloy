/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(['duckdb']));

afterAll(async () => {
  await runtimes.closeAll();
});

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  it(`number param used in dimension - ${databaseName}`, async () => {
    await expect(`
      ##! experimental.cube_sources
      source: state_facts is ${databaseName}.table('malloytest.state_facts')
      source: x is cube(state_facts, state_facts extend { dimension: foo is 1 })
      run: x -> { select: foo }
    `).malloyResultMatches(runtime, {foo: 1});
  });
});
