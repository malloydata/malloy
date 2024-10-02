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
  const markData = "{ first: 'Mark', surname: 'Tonka' }";
  const mackData = "{ first: 'Mack', surname: 'Truck' }";
  const model = runtime.loadModel(
    `source: people is ${dbName}.sql("SELECT ${markData} AS name, [ ${markData}, ${mackData} ] as zznames")`
  );
  test('record access', async () => {
    await expect(
      'run: people -> { select: a is name.first, b is name.surname }'
    ).malloyResultMatches(model, {a: 'Mark', b: 'Tonka'});
  });
  test('select entire record', async () => {
    await expect('run: people -> { select: name }').malloyResultMatches(model, {
      'name/first': 'Mark',
      'name/surname': 'Tonka',
    });
  });
  test('group_by entire record', async () => {
    await expect('run: people -> { group_by: name }').malloyResultMatches(
      model,
      {
        'name/first': 'Mark',
        'name/surname': 'Tonka',
      }
    );
  });
  test('record literal', async () => {
    await expect(
      "run: people -> { select: buddy is {first is 'Mack', surname is 'Truck'} }"
    ).malloyResultMatches(model, {
      'buddy/first': 'Mack',
      'buddy/surname': 'Truck',
    });
  });
  // mtoy todo add a "translationToFailWith" test for { n is count()} in lang/test
  test('nested rec literal', async () => {
    await expect(
      "run: people -> { select: friends is { best is { first is 'Mack', surname is 'Truck'} } }"
    ).malloyResultMatches(model, {
      'friends/best/first': 'Mack',
      'friends/best/surname': 'Truck',
    });
  });
  test('nested value literal', async () => {
    await expect(
      'run: people -> { select: friends is { best is name } }'
    ).malloyResultMatches(model, {
      'friends/best/first': 'Mack',
      'friends/best/surname': 'Truck',
    });
  });
  test('literal record with inferred key names', async () => {
    await expect(
      'run: people -> { select: dad_name is {first is "Morgan", name.surname} }'
    ).malloyResultMatches(model, {
      'dad_name/first': 'Morgan',
      'dad_name/surname': 'Tonka',
    });
  });
});
