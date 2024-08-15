/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {RuntimeList} from '../../runtimes';
import '../../util/db-jest-matchers';
import {databasesFromEnvironmentOr} from '../../util';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(['duckdb']));

describe.each(runtimes.runtimeList)('%s record types', (dbName, runtime) => {
  const sqlTestData = "{ first: 'Mark', last: 'Tonka' }";
  const model = runtime.loadModel(
    `source: people is ${dbName}.sql("SELECT ${sqlTestData} AS name")`
  );
  test('record access', async () => {
    await expect(
      'run: people -> { select: a is name.first, b is name.`last` }'
    ).malloyResultMatches(model, {a: 'Mark', b: 'Tonka'});
  });
  test('select entire record', async () => {
    await expect('run: people -> { select: name }').malloyResultMatches(model, {
      'name/first': 'Mark',
      'name/last': 'Tonka',
    });
  });
  test('group_by entire record', async () => {
    await expect('run: people -> { group_by: name }').malloyResultMatches(
      model,
      {
        'name/first': 'Mark',
        'name/last': 'Tonka',
      }
    );
  });
  test('record literal', async () => {
    await expect(
      "run: people -> { select: name is {first is 'Mack', last is 'Truck'} }"
    ).malloyResultMatches(model, {
      'name/first': 'Mack',
      'name/last': 'Truck',
    });
  });
  test('record literal with inferred key names', async () => {
    await expect(
      'run: people -> { select: name is {name.first, name.last} }'
    ).malloyResultMatches(model, {
      'name/first': 'Mark',
      'name/last': 'Tonka',
    });
  });
});
