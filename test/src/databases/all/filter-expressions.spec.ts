/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import '../../util/db-jest-matchers';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)('filter expressions %s', (_dbName, db) => {
  test('abc', () => {
    expect(`
      run: duckdb.sql("SELECT 'abc' as s UNION ALL SELECT 'def'") -> {
        where: s ~ f'abc';
        select: s
      }`).malloyResultMatches(db, [{s: 'abc'}]);
  });
});

afterAll(async () => {
  await runtimes.closeAll();
});
