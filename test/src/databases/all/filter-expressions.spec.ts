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

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)('filter expressions %s', (dbName, db) => {
  const abc = db.loadModel(`
    source: abc is ${dbName}.sql("""
      SELECT 'abc' as s, 'abc' as row
      UNION ALL SELECT 'def', 'def'
      UNION ALL SELECT null, 'null'
      UNION ALL SELECT '', 'empty'

    """)
  `);

  test('abc', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'abc';
        select: s
      }`).malloyResultMatches(abc, [{s: 'abc'}]);
  });
  test('abc,def', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'abc,def';
        select: s
      }`).malloyResultMatches(abc, [{s: 'abc'}, {s: 'def'}]);
  });
  test('-abc', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-abc',
        select: row
      }`).malloyResultMatches(abc, [
      {row: 'def'},
      {row: 'null'},
      {row: 'empty'},
    ]);
  });
  test('-starts', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-a%',
        select: row
      }`).malloyResultMatches(abc, [
      {row: 'def'},
      {row: 'null'},
      {row: 'empty'},
    ]);
  });
  test('-contains', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-%b%',
        select: row
      }`).malloyResultMatches(abc, [
      {row: 'def'},
      {row: 'null'},
      {row: 'empty'},
    ]);
  });
  test('-end', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-%c',
        select: row
      }`).malloyResultMatches(abc, [
      {row: 'def'},
      {row: 'null'},
      {row: 'empty'},
    ]);
  });
  test('unlike', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-a%c',
        select: row
      }`).malloyResultMatches(abc, [
      {row: 'def'},
      {row: 'null'},
      {row: 'empty'},
    ]);
  });
  test('simple but not _%,-abc', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'_%,-abc';
        select: s
      }`).malloyResultMatches(abc, [{s: 'def'}]);
  });
  test('empty', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'empty'
        select: row
      }`).malloyResultMatches(abc, [{row: 'null'}, {row: 'empty'}]);
  });
  test('-empty', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-empty'
        select: row
      }`).malloyResultMatches(abc, [{row: 'abc'}, {row: 'def'}]);
  });
  test('null', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'null'
        select: row
      }`).malloyResultMatches(abc, [{row: 'null'}]);
  });
  test('-null', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'-null'
        select: row
      }`).malloyResultMatches(abc, [
      {row: 'abc'},
      {row: 'def'},
      {row: 'empty'},
    ]);
  });
  test('starts', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'a%';
        select: s
      }`).malloyResultMatches(abc, [{s: 'abc'}]);
  });
  test('contains', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'%b%,%e%';
        select: s
      }`).malloyResultMatches(abc, [{s: 'abc'}, {s: 'def'}]);
  });
  test('ends', async () => {
    await expect(`
      run: abc -> {
        where: s ~ f'%c';
        select: s
      }`).malloyResultMatches(abc, [{s: 'abc'}]);
  });
});
