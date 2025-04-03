/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import '../../util/db-jest-matchers';
import {databasesFromEnvironmentOr} from '../../util';
import {DateTime as LuxonDateTime} from 'luxon';
import {mkSQLSource} from '../../util/db-matcher-support';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)('filter expressions %s', (dbName, db) => {
  const q = db.getQuoter();
  describe('string filter expressions', () => {
    function got(s: string) {
      const zipMe = s.split(',');
      return zipMe.map(s => ({nm: s}));
    }
    const xbq = db.dialect.sqlLiteralString('x\\');
    const abc = db.loadModel(`
      source: abc is ${dbName}.sql("""
        SELECT 'abc' as ${q`s`}, 'abc' as ${q`nm`}
        UNION ALL SELECT 'def', 'def'
        UNION ALL SELECT ${xbq}, 'xback'
        UNION ALL SELECT '', 'z-empty'
        UNION ALL SELECT null, 'z-null'
      """)
    `);

    test('is abc', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'abc';
          select: s
        }`).malloyResultMatches(abc, [{s: 'abc'}]);
    });
    test('empty string filter expression', async () => {
      /*
        since the sql generated works when pasted into mysql
        my next suggestion is that there is some funky re-ordering
        happening in the result processing which will test tomorrow
      */
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'';
          select: *; order_by: nm asc
        }`).malloyResultMatches(abc, got('abc,def,xback,z-empty,z-null'));
    });
    test('abc,def', async () => {
      await expect(`
        run: abc -> {
          where: s ~ f'abc,def';
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('abc,def'));
    });
    test('-abc', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-abc',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('def,xback,z-empty,z-null'));
    });
    test('-starts', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-a%',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('def,xback,z-empty,z-null'));
    });
    test('-contains', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-%b%',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('def,xback,z-empty,z-null'));
    });
    test('-end', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-%c',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('def,xback,z-empty,z-null'));
    });
    test('unlike', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-a%c',
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('def,xback,z-empty,z-null'));
    });
    test('simple but not ___,-abc', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'___,-abc';
          select: s
        }`).malloyResultMatches(abc, [{s: 'def'}]);
    });
    test('empty', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'empty'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('z-empty,z-null'));
    });
    test('-empty', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-empty'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('abc,def,xback'));
    });
    test('null', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'null'
          select: nm
        }`).malloyResultMatches(abc, got('z-null'));
    });
    test('-null', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'-null'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('abc,def,xback,z-empty'));
    });
    test('starts', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'a%';
          select: s
        }`).malloyResultMatches(abc, [{s: 'abc'}]);
    });
    test('contains', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'%b%,%e%';
          select: *; order_by: nm asc
        }`).malloyResultMatches(abc, [{s: 'abc'}, {s: 'def'}]);
    });
    test('simple ends', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'%c';
          select: s
        }`).malloyResultMatches(abc, [{s: 'abc'}]);
    });
    test('ends in backslash', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'%\\\\'
          select: nm
        }`).malloyResultMatches(abc, got('xback'));
    });
    test('= x backslash', async () => {
      await expect(`
        # test.verbose
        run: abc -> {
          where: s ~ f'x\\\\'
          select: nm
        }`).malloyResultMatches(abc, got('xback'));
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
    test('empty numeric filter', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f''
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [
        {t: '0'},
        {t: '1'},
        {t: '2'},
        {t: '3'},
        {t: '4'},
        {t: 'null'},
      ]);
    });
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

  // mysql doesn't have true booleans ...
  const testBoolean = !db.dialect.booleanAsNumbers;
  describe('boolean filter expressions', () => {
    const facts = db.loadModel(`
      source: facts is ${dbName}.sql("""
        SELECT true as ${q`b`}, 'true' as ${q`t`}
        UNION ALL SELECT false, 'false'
        UNION ALL SELECT NULL, 'null'
      """)
    `);
    test.when(testBoolean)('true', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('true', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('false', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'false'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'null'}]);
    });
    test.when(testBoolean)('=false', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'=false'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}]);
    });
    test.when(testBoolean)('null', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'null'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'null'}]);
    });
    test.when(testBoolean)('not null', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f'not null'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'true'}]);
    });
    test.when(testBoolean)('empty boolean filter', async () => {
      await expect(`
        run: facts -> {
          where: b ~ f''
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [
        {t: 'false'},
        {t: 'null'},
        {t: 'true'},
      ]);
    });
  });

  type TL = 'timeLiteral';

  describe('temporal filters', () => {
    function lit(t: string, type: 'timestamp' | 'date'): string {
      const typeDef: {type: 'timestamp' | 'date'} = {type};
      const timeLiteral: TL = 'timeLiteral';
      const n = {
        node: timeLiteral,
        typeDef,
        literal: t,
      };
      return db.dialect.sqlLiteralTime({}, n);
    }

    const fTimestamp = 'yyyy-LL-dd HH:mm:ss';
    const fDate = 'yyyy-LL-dd';

    /**
     * Create a source for testing a range. It will have five rows
     * { t: 1 second before start, n: 'before' }
     * { t: start,                 n: 'first' }
     * { t: 1 second before end,   n: 'last' }
     * { t: end,                   n: 'post-range' }
     * { t: NULL                   n: 'z-null' }
     * Use malloyResultMatches(range, inRange) or (range, notInRange)
     */
    const inRange = [{n: 'first'}, {n: 'last'}];
    const notInRange = [{n: 'before'}, {n: 'post-range'}];
    function mkRange(start: string, end: string) {
      const begin = LuxonDateTime.fromFormat(start, fTimestamp);
      const b4 = begin.minus({second: 1});
      const last = LuxonDateTime.fromFormat(end, fTimestamp).minus({second: 1});
      const rangeSQL = mkSQLSource(
        db.dialect,
        dbName,
        {t: 'timestamp', n: 'string'},
        [b4.toFormat(fTimestamp), 'before'],
        [start, 'first'],
        [last.toFormat(fTimestamp), 'last'],
        [end, 'post-range'],
        [null, 'z-null']
      );
      const rangeModel = `query: range is ${rangeSQL} -> {select: *; order_by: n}`;
      return db.loadModel(rangeModel);
    }
    function mkDateRange(start: string, end: string) {
      const begin = LuxonDateTime.fromFormat(start, fDate);
      const b4 = begin.minus({day: 1});
      const last = LuxonDateTime.fromFormat(end, fDate).minus({day: 1});
      const rangeSQL = mkSQLSource(
        db.dialect,
        dbName,
        {t: 'date', n: 'string'},
        [b4.toFormat(fDate), 'before'],
        [start, 'first'],
        [last.toFormat(fDate), 'last'],
        [end, 'post-range'],
        [null, 'z-null']
      );
      const rangeModel = `query: range is ${rangeSQL} -> {select: *; order_by: n}`;
      return db.loadModel(rangeModel);
    }
    function mkEqTime(exact: string) {
      const eqSQL = mkSQLSource(
        db.dialect,
        dbName,
        {t: 'timestamp', n: 'string'},
        [exact, 'exact']
      );
      return db.loadModel(`query: eqtime is ${eqSQL} -> {select: t,n}`);
    }

    /**
     * All the relative time tests need a way to set what time it is now
     */
    function nowIs(timeStr: string) {
      const spyNow = jest.spyOn(db.dialect, 'sqlNowExpr');
      spyNow.mockImplementation(() => lit(timeStr, 'timestamp'));
    }
    afterEach(() => jest.restoreAllMocks());

    test('date after quarter', async () => {
      const range = mkDateRange('2001-01-01', '2001-04-01');
      await expect(`
        run: range + { where: t ~ f'after 2001-Q1' }
      `).malloyResultMatches(range, {n: 'post-range'});
    });
    test('date before month', async () => {
      const range = mkDateRange('2001-01-01', '2001-02-01');
      await expect(`
        run: range + { where: t ~ f'before 2001-01' }
      `).malloyResultMatches(range, {n: 'before'});
    });
    test('date in year', async () => {
      const range = mkDateRange('2001-01-01', '2002-01-01');
      await expect(`
        run: range + { where: t ~ f'2001' }
      `).malloyResultMatches(range, inRange);
    });
    test('2 days ago', async () => {
      nowIs('2001-01-15 12:00:00');
      const range = mkRange('2001-01-13 00:00:00', '2001-01-14 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2 days ago' }
      `).malloyResultMatches(range, inRange);
    });
    test('2 days', async () => {
      nowIs('2001-01-15 12:00:00');
      const range = mkRange('2001-01-14 00:00:00', '2001-01-16 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2 days' }
      `).malloyResultMatches(range, inRange);
    });
    test('2 days from now', async () => {
      nowIs('2001-01-15 12:00:00');
      const range = mkRange('2001-01-17 00:00:00', '2001-01-18 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2 days from now' }
      `).malloyResultMatches(range, inRange);
    });
    test('2000 to 2001', async () => {
      const range = mkRange('2000-01-01 00:00:00', '2001-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2000 to 2001' }
      `).malloyResultMatches(range, inRange);
    });
    test('next 2 days', async () => {
      nowIs('2001-01-01 12:00:00');
      const range = mkRange('2001-01-02 00:00:00', '2001-01-04 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next 2 days' }
      `).malloyResultMatches(range, inRange);
    });
    test('last 2 months', async () => {
      nowIs('2001-01-01 12:00:00');
      const range = mkRange('2000-11-01 00:00:00', '2001-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'last 2 months' }
      `).malloyResultMatches(range, inRange);
    });
    test('before y2k', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'before 2001' }
      `).malloyResultMatches(range, [{n: 'before'}]);
    });
    test('after y2k', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'after 2001' }
      `).malloyResultMatches(range, [{n: 'post-range'}]);
    });
    test('y2k for 1 minute', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-01-01 00:01:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 1 minute' }
      `).malloyResultMatches(range, inRange);
    });
    test('y2k for 2 hour', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-01-01 02:00:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 2 hour' }
      `).malloyResultMatches(range, inRange);
    });
    test('y2k for 1 day', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-01-02 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 1 day' }
      `).malloyResultMatches(range, inRange);
    });
    test('y2k for 1 week', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-01-08 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 1 week' }
      `).malloyResultMatches(range, inRange);
    });
    test('y2k for 1 month', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-02-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 1 month' }
      `).malloyResultMatches(range, inRange);
    });
    test('y2k for 1 quarter', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-04-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 1 quarter' }
      `).malloyResultMatches(range, inRange);
    });
    test('y2k for 1 year', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001 for 1 year' }
      `).malloyResultMatches(range, inRange);
    });
    test('null', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'null' }
      `).malloyResultMatches(range, [{n: 'z-null'}]);
    });
    test('not null', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'not null'; order_by: n }
      `).malloyResultMatches(range, [
        {n: 'before'},
        {n: 'first'},
        {n: 'last'},
        {n: 'post-range'},
      ]);
    });
    test('empty temporal filter', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        # test.verbose
        run: range + { where: t ~ f''; order_by: n }
      `).malloyResultMatches(range, [
        {n: 'before'},
        {n: 'first'},
        {n: 'last'},
        {n: 'post-range'},
        {n: 'z-null'},
      ]);
    });
    test('year literal', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001' }
      `).malloyResultMatches(range, inRange);
    });
    test('not month literal', async () => {
      const range = mkRange('2001-06-01 00:00:00', '2001-07-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'not 2001-06' }
      `).malloyResultMatches(range, notInRange);
    });
    test('day literal', async () => {
      const range = mkRange('2001-06-15 00:00:00', '2001-06-16 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001-06-15' }
      `).malloyResultMatches(range, inRange);
    });
    test('hour literal', async () => {
      const range = mkRange('2001-02-03 04:00:00', '2001-02-03 05:00:00');
      await expect(`
        run: range + { where: t ~ f'2001-02-03 04' }
      `).malloyResultMatches(range, inRange);
    });
    test('minute literal', async () => {
      const range = mkRange('2001-02-03 04:05:00', '2001-02-03 04:06:00');
      await expect(`
        run: range + { where: t ~ f'2001-02-03 04:05' }
      `).malloyResultMatches(range, inRange);
    });
    test('quarter literal', async () => {
      const range = mkRange('2001-01-01 00:00:00', '2001-04-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2001-Q1' }
      `).malloyResultMatches(range, inRange);
    });
    test('week literal', async () => {
      const range = mkRange('2023-01-01 00:00:00', '2023-01-08 00:00:00');
      await expect(`
        run: range + { where: t ~ f'2023-01-01-WK' }
      `).malloyResultMatches(range, inRange);
    });
    test('full second literal', async () => {
      const eqtime = mkEqTime('2023-01-01 01:02:03');
      await expect(`
        run: eqtime + { where: t ~ f'2023-01-01 01:02:03' }
      `).malloyResultMatches(eqtime, [{n: 'exact'}]);
    });
    test('subsecond literal', async () => {
      const eqtime = mkEqTime('2023-01-01 01:02:03.04');
      await expect(`
        run: eqtime + { where: t ~ f'2023-01-01 01:02:03.04' }
      `).malloyResultMatches(eqtime, [{n: 'exact'}]);
    });
    test('today', async () => {
      nowIs('2001-02-03 12:00:00');
      const range = mkRange('2001-02-03 00:00:00', '2001-02-04 00:00:00');
      await expect(`
        run: range + { where: t ~ f'today' }
      `).malloyResultMatches(range, inRange);
    });
    test('yesterday', async () => {
      nowIs('2001-02-03 12:00:00');
      const range = mkRange('2001-02-02 00:00:00', '2001-02-03 00:00:00');
      await expect(`
        run: range + { where: t ~ f'yesterday' }
      `).malloyResultMatches(range, inRange);
    });
    test('tomorrow', async () => {
      nowIs('2001-02-03 12:00:00');
      const range = mkRange('2001-02-04 00:00:00', '2001-02-05 00:00:00');
      await expect(`
        run: range + { where: t ~ f'tomorrow' }
      `).malloyResultMatches(range, inRange);
    });
    test('this week', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-01 00:00:00', '2023-01-08 00:00:00');
      await expect(`
        run: range + { where: t ~ f'this week' }
      `).malloyResultMatches(range, inRange);
    });
    test('last month', async () => {
      nowIs('2001-02-01 12:00:00');
      const range = mkRange('2001-01-01 00:00:00', '2001-02-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'last month' }
      `).malloyResultMatches(range, inRange);
    });
    test('next quarter', async () => {
      nowIs('2001-01-02 12:00:00');
      const range = mkRange('2001-04-01 00:00:00', '2001-07-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next quarter' }
      `).malloyResultMatches(range, inRange);
    });
    test('this year', async () => {
      nowIs('2001-01-02 12:00:00');
      const range = mkRange('2001-01-01 00:00:00', '2002-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'this year' }
      `).malloyResultMatches(range, inRange);
    });
    // 2023-01-01 is a sunday
    test('(last) sunday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-01 00:00:00', '2023-01-02 00:00:00');
      await expect(`
        run: range + { where: t ~ f'sunday' }
      `).malloyResultMatches(range, inRange);
    });
    test('last monday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-02 00:00:00', '2023-01-03 00:00:00');
      await expect(`
        run: range + { where: t ~ f'last monday' }
      `).malloyResultMatches(range, inRange);
    });
    test('last-tuesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2022-12-27 00:00:00', '2022-12-28 00:00:00');
      await expect(`
        run: range + { where: t ~ f'tuesday' }
      `).malloyResultMatches(range, inRange);
    });
    test('last-wednesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2022-12-28 00:00:00', '2022-12-29 00:00:00');
      await expect(`
        run: range + { where: t ~ f'wednesday' }
      `).malloyResultMatches(range, inRange);
    });
    test('last-thursday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2022-12-29 00:00:00', '2022-12-30 00:00:00');
      await expect(`
        run: range + { where: t ~ f'thursday' }
      `).malloyResultMatches(range, inRange);
    });
    test('last-friday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2022-12-30 00:00:00', '2022-12-31 00:00:00');
      await expect(`
        run: range + { where: t ~ f'friday' }
      `).malloyResultMatches(range, inRange);
    });
    test('last saturday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2022-12-31 00:00:00', '2023-01-01 00:00:00');
      await expect(`
        run: range + { where: t ~ f'last saturday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next sunday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-08 00:00:00', '2023-01-09 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next sunday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next monday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-09 00:00:00', '2023-01-10 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next monday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next tuesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-10 00:00:00', '2023-01-11 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next tuesday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next wednesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-04 00:00:00', '2023-01-05 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next wednesday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next thursday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-05 00:00:00', '2023-01-06 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next thursday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next friday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-06 00:00:00', '2023-01-07 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next friday' }
      `).malloyResultMatches(range, inRange);
    });
    test('next saturday', async () => {
      nowIs('2023-01-03 00:00:00');
      const range = mkRange('2023-01-07 00:00:00', '2023-01-08 00:00:00');
      await expect(`
        run: range + { where: t ~ f'next saturday' }
      `).malloyResultMatches(range, inRange);
    });
  });
});
