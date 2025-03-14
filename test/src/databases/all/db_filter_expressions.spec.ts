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

// mtoy todo sit down with each parser and compiler and make sure there is a test for every case

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
  });

  describe('numeric filter expressions', () => {
    const nums = db.loadModel(`
      source: nums is ${dbName}.sql("""
        SELECT 0 as ${q`n`}, '0' as ${q`t`}
        UNION ALL SELECT 1, '1'
        UNION ALL SELECT 2, '2'
        UNION ALL SELECT 3, '3'
        UNION ALL SELECT 4, '4'
        UNION ALL SELECT NULL, 'null'
      """)
    `);
    test('2', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'2'
          select: n
        }`).malloyResultMatches(nums, [{n: 2}]);
    });
    test('!= 2', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'!= 2'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [
        {t: '0'},
        {t: '1'},
        {t: '3'},
        {t: '4'},
        {t: 'null'},
      ]);
    });
    test('[1 to 3]', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'[1 to 3]'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '1'}, {t: '2'}, {t: '3'}]);
    });
    test('not [1 to 3]', async () => {
      await expect(`
        # test.verbose
        run: nums -> {
          where: n ~ f'not [1 to 3]'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '0'}, {t: '4'}]);
    });
    test('123', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'1,2,3'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '1'}, {t: '2'}, {t: '3'}]);
    });
    test('not 123', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'not 1,2,3'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '0'}, {t: '4'}, {t: 'null'}]);
    });
    test('(1 to 3]', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'(1 to 3]'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '2'}, {t: '3'}]);
    });
    test('[1 to 3)', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'[1 to 3)'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '1'}, {t: '2'}]);
    });
    test('(1 to 3)', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'(1 to 3)'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [{t: '2'}]);
    });
    test('>3', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'>3'
          select: n
        }`).malloyResultMatches(nums, [{n: 4}]);
    });
    test('>=3', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'>=3'
          select: n; order_by:n asc
        }`).malloyResultMatches(nums, [{n: 3}, {n: 4}]);
    });
    test('<1', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'<1'
          select: n
        }`).malloyResultMatches(nums, [{n: 0}]);
    });
    test('<=1', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'<=1'
          select: n; order_by: n asc
        }`).malloyResultMatches(nums, [{n: 0}, {n: 1}]);
    });
  });

  describe('boolean filter expressions', () => {
    const facts = db.loadModel(`
      source: facts is ${dbName}.sql("""
        SELECT true as ${q`b`}, 'true' as ${q`t`}
        UNION ALL SELECT false, 'false'
        UNION ALL SELECT NULL, 'null'
      """)
    `);
    test('true', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test('true', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test('false', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'false'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'null'}]);
    });
    test('=false', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'=false'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}]);
    });
    test('null', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'null'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'null'}]);
    });
    test('not null', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'not null'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'true'}]);
    });
  });
});
