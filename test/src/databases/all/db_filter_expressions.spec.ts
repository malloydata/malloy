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
  const q = db.getQuoter();
  describe('string filter expressions', () => {
    const bq = db.dialect.sqlLiteralString('x\\');
    const abc = db.loadModel(`
      source: abc is ${dbName}.sql("""
        SELECT 'abc' as ${q`s`}, '0 - abc' as ${q`nm`}
        UNION ALL SELECT 'def', '1 - def'
        UNION ALL SELECT null, '2 - null'
        UNION ALL SELECT '', '3 - empty'
        UNION ALL SELECT ${bq}, '4 - xback'
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
          select: nm; order_by: nm
        }`).malloyResultMatches(abc, [{nm: '0 - abc'}, {nm: '1 - def'}]);
    });
    test('-abc', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-abc',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '1 - def'},
        {nm: '2 - null'},
        {nm: '3 - empty'},
        {nm: '4 - xback'},
      ]);
    });
    test('-starts', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-a%',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '1 - def'},
        {nm: '2 - null'},
        {nm: '3 - empty'},
        {nm: '4 - xback'},
      ]);
    });
    test('-contains', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-%b%',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '1 - def'},
        {nm: '2 - null'},
        {nm: '3 - empty'},
        {nm: '4 - xback'},
      ]);
    });
    test('-end', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-%c',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '1 - def'},
        {nm: '2 - null'},
        {nm: '3 - empty'},
        {nm: '4 - xback'},
      ]);
    });
    test('unlike', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-a%c',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '1 - def'},
        {nm: '2 - null'},
        {nm: '3 - empty'},
        {nm: '4 - xback'},
      ]);
    });
    test('simple but not ___,-abc', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'___,-abc';
          select: s
        }`).malloyResultMatches(abc, [{s: 'def'}]);
    });
    test('empty', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'empty'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [{nm: '2 - null'}, {nm: '3 - empty'}]);
    });
    test('-empty', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-empty'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '0 - abc'},
        {nm: '1 - def'},
        {nm: '4 - xback'},
      ]);
    });
    test('null', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'null'
          select: nm
        }`).malloyResultMatches(abc, [{nm: '2 - null'}]);
    });
    test('-null', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'-null'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, [
        {nm: '0 - abc'},
        {nm: '1 - def'},
        {nm: '3 - empty'},
        {nm: '4 - xback'},
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
          select: s; order_by: s asc
        }`).malloyResultMatches(abc, [{s: 'abc'}, {s: 'def'}]);
    });
    test('simple ends', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'%c';
          select: s
        }`).malloyResultMatches(abc, [{s: 'abc'}]);
    });
    test('ends in backslash', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'%\\\\'
          select: nm
        }`).malloyResultMatches(abc, [{nm: '4 - xback'}]);
    });
    test('= x backslash', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'x\\\\'
          select: nm
        }`).malloyResultMatches(abc, [{nm: '4 - xback'}]);
    });
    // mtoy todo ands ors parens nots escaping
  });
});
