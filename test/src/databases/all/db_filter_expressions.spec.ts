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
      await expect(`
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
        run: abc -> {
          where: s ~ f'empty'
          select: nm; order_by: nm asc
        }`).malloyResultMatches(abc, got('z-empty,z-null'));
      await expect(`
          run: abc -> {
            where: s ~ f'EmpTy'
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
        run: abc -> {
          where: s ~ f'null'
          select: nm
        }`).malloyResultMatches(abc, got('z-null'));
      await expect(`
        run: abc -> {
          where: s ~ f'nULl'
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
    test('string or with pipe', async () => {
      await expect(`
    run: abc -> {
      where: s ~ f'abc | def'
      select: nm; order_by: nm asc
    }`).malloyResultMatches(abc, got('abc,def'));
    });

    test('string and with semicolon', async () => {
      await expect(`
    run: abc -> {
      where: s ~ f'%b% ; %c'
      select: nm; order_by: nm asc
    }`).malloyResultMatches(abc, got('abc'));
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
    test('numeric filters are case insensitive', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'([1 tO 3] aNd [1 To 4]) oR NuLl'
          select: t; order_by: t asc
        }`).malloyResultMatches(nums, [
        {t: '1'},
        {t: '2'},
        {t: '3'},
        {t: 'null'},
      ]);
    });
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
    test('not <=1', async () => {
      await expect(`
          run: nums -> {
            where: n ~ f'not <=1'
            select: n; order_by: n asc
          }`).malloyResultMatches(nums, [{n: 2}, {n: 3}, {n: 4}]);
    });
    test('not null and not 0,1,2', async () => {
      await expect(`
        run: nums -> {
          where: n ~ f'not null and not 0,1,2'
          select: n; order_by: n asc
        }`).malloyResultMatches(nums, [{n: 3}, {n: 4}]);
    });
  });

  const testBoolean = db.dialect.booleanType !== 'none';
  describe('boolean filter expressions', () => {
    /*
     * We have the following truth table for boolean filters.
     * The default malloy operations treat null as false. The '='
     * variants exist for cases where that is not desired.
     *
     * filter expression | x=true | x=false | x=null
     * true              |   T    |   F     |   F
     * not true          |   F    |   T     |   T
     * =true             |   T    |   F     |   NULL
     * not =true         |   F    |   T     |   NULL
     * false             |   F    |   T     |   T
     * not false         |   T    |   F     |   F
     * =false            |   F    |   T     |   NULL
     * not =false        |   T    |   F     |   NULL
     */
    const facts = db.loadModel(`
      source: facts is ${dbName}.sql("""
        SELECT true as ${q`b`}, 'true' as ${q`t`}
        UNION ALL SELECT false, 'false'
        UNION ALL SELECT NULL, 'null'
      """)
    `);
    const factsSrc =
      db.dialect.booleanType === 'supported'
        ? 'facts'
        : 'facts extend {rename: sqlb is b; dimension: b is sqlb ? pick true when =true pick false when =false else null}';
    test.when(testBoolean)('true', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'tRuE'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('=true', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'=TRUE'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('not =true', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'not =true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}]);
    });
    test.when(testBoolean)('false', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'FalSE'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'null'}]);
    });
    test.when(testBoolean)('=false', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'=FALSE'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}]);
    });
    test.when(testBoolean)('null', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'Null'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'null'}]);
    });
    test.when(testBoolean)('not null', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f'nOt NuLL'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'true'}]);
    });
    test.when(testBoolean)('not true', async () => {
      await expect(`
    run: ${factsSrc} -> {
      where: b ~ f'not true'
      select: t; order_by: t asc
    }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'null'}]);
    });
    test.when(testBoolean)('not false', async () => {
      await expect(`
    run: ${factsSrc} -> {
      where: b ~ f'not false'
      select: t; order_by: t asc
    }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('not =false', async () => {
      await expect(`
    run: ${factsSrc} -> {
      where: b ~ f'not =false'
      select: t; order_by: t asc
    }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('true (non-column)', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: (pick b when 1=1 else false) ~ f'true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('not true (non-column)', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: (pick b when 1=1 else false) ~ f'not true'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'null'}]);
    });
    test.when(testBoolean)('false (non-column)', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: (pick b when 1=1 else false) ~ f'false'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'false'}, {t: 'null'}]);
    });
    test.when(testBoolean)('not false (non-column)', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: (pick b when 1=1 else false) ~ f'not false'
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [{t: 'true'}]);
    });
    test.when(testBoolean)('empty boolean filter', async () => {
      await expect(`
        run: ${factsSrc} -> {
          where: b ~ f''
          select: t; order_by: t asc
        }`).malloyResultMatches(facts, [
        {t: 'false'},
        {t: 'null'},
        {t: 'true'},
      ]);
    });
  });

  describe('temporal filters', () => {
    function tsLit(at: LuxonDateTime): string {
      const typeDef: {type: 'timestamp' | 'date'} = {type: 'timestamp'};
      const node: {node: 'timeLiteral'} = {node: 'timeLiteral'};
      const timeStr = at.toUTC().toFormat(fTimestamp);
      const n = {...node, typeDef, literal: timeStr};
      return db.dialect.sqlLiteralTime({}, n);
    }
    function lit(t: string, type: 'timestamp' | 'date'): string {
      const typeDef: {type: 'timestamp' | 'date'} = {type};
      const node: {node: 'timeLiteral'} = {node: 'timeLiteral'};
      const n = {...node, typeDef, literal: t};
      return db.dialect.sqlLiteralTime({}, n);
    }

    const fTimestamp = 'yyyy-LL-dd HH:mm:ss';
    const fDate = 'yyyy-LL-dd';

    const inRange = [{n: 'first'}, {n: 'last'}];
    const notInRange = [{n: 'before'}, {n: 'post-range'}];

    /**
     * Create a query for testing temporal filters with better timezone handling.
     * Returns a complete Malloy query string with the filter and timezone in the same segment.
     * Result will have five rows:
     * { t: 1 second before start, n: 'before' }
     * { t: start,                 n: 'first' }
     * { t: 1 second before end,   n: 'last' }
     * { t: end,                   n: 'post-range' }
     * { t: NULL                   n: 'z-null' }
     * Use malloyResultMatches(range, inRange) or (range, notInRange)
     *
     * If a timezone is provided then ...
     * - the start and end times are considered to be in that timezone
     * - the query generated will include a timezone: directive
     * - the filter expression is evaluated in that timezone
     */
    function mkRangeQuery(
      filterExpr: string,
      start: string,
      end: string,
      queryTimezone?: string
    ): string {
      const zone = queryTimezone ?? 'UTC';

      // Convert the civil time to the desired timezone
      const begin = LuxonDateTime.fromFormat(start, fTimestamp, {zone});
      const endTime = LuxonDateTime.fromFormat(end, fTimestamp, {zone});

      const b4 = begin.minus({second: 1});
      const last = endTime.minus({second: 1});

      const timezoneClause = queryTimezone
        ? `timezone: '${queryTimezone}';`
        : '';

      return `
        run: ${dbName}.sql("""
          SELECT ${tsLit(b4)} AS ${q`t`}, 'before' AS ${q`n`}
          UNION ALL SELECT ${tsLit(begin)}, 'first'
          UNION ALL SELECT ${tsLit(last)} , 'last'
          UNION ALL SELECT ${tsLit(endTime)}, 'post-range'
          UNION ALL SELECT NULL, 'z-null'
        """) -> {
          ${timezoneClause}
          where: t ~ ${filterExpr}
          select: t, n
          order_by: n
        }
      `;
    }

    function mkDateRange(start: string, end: string) {
      const begin = LuxonDateTime.fromFormat(start, fDate);
      const b4 = begin.minus({day: 1});
      const last = LuxonDateTime.fromFormat(end, fDate).minus({day: 1});
      const rangeModel = `
        query: range is ${dbName}.sql("""
          SELECT ${lit(
            b4.toFormat(fDate),
            'date'
          )} AS ${q`t`}, 'before' AS ${q`n`}
          UNION ALL SELECT ${lit(start, 'date')}, 'first'
          UNION ALL SELECT ${lit(last.toFormat(fDate), 'date')} , 'last'
          UNION ALL SELECT ${lit(end, 'date')}, 'post-range'
          UNION ALL SELECT NULL, 'z-null'
        """)
        -> {select: t,n; order_by: n}`;
      return db.loadModel(rangeModel);
    }
    function mkEqTime(exact: string) {
      return db.loadModel(
        `query: eqtime is ${dbName}.sql("""
          SELECT ${lit(exact, 'timestamp')} AS ${q`t`}, 'exact' as ${q`n`}
        """) -> {select: t, n}`
      );
    }

    /**
     * All the relative time tests need a way to set what time it is now
     */
    function nowIs(nowStr: string, zone = 'UTC') {
      const spyNow = jest.spyOn(db.dialect, 'sqlNowExpr');
      spyNow.mockImplementation(() => {
        const utcTime = LuxonDateTime.fromFormat(nowStr, fTimestamp, {zone});
        return tsLit(utcTime);
      });
    }
    afterEach(() => jest.restoreAllMocks());

    test('date after quarter', async () => {
      const range = mkDateRange('2001-01-01', '2001-04-01');
      await expect(`
        run: range + { where: t ~ f'AFTER 2001-Q1' }
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
      const rangeQuery = mkRangeQuery(
        "f'2 days ago'",
        '2001-01-13 00:00:00',
        '2001-01-14 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('2 days', async () => {
      nowIs('2001-01-15 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'2 days'",
        '2001-01-14 00:00:00',
        '2001-01-16 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('2 days from now', async () => {
      nowIs('2001-01-15 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'2 days from now'",
        '2001-01-17 00:00:00',
        '2001-01-18 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('2000 to 2001', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2000 to 2001'",
        '2000-01-01 00:00:00',
        '2001-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next 2 days', async () => {
      nowIs('2001-01-01 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next 2 days'",
        '2001-01-02 00:00:00',
        '2001-01-04 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last 2 months', async () => {
      nowIs('2001-01-01 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'last 2 months'",
        '2000-11-01 00:00:00',
        '2001-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('before y2k', async () => {
      const rangeQuery = mkRangeQuery(
        "f'before 2001'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, [{n: 'before'}]);
    });
    test('after y2k', async () => {
      const rangeQuery = mkRangeQuery(
        "f'after 2001'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, [{n: 'post-range'}]);
    });
    test('y2k for 1 minute', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 1 minute'",
        '2001-01-01 00:00:00',
        '2001-01-01 00:01:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('y2k for 2 hour', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 2 hour'",
        '2001-01-01 00:00:00',
        '2001-01-01 02:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('y2k for 1 day', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 1 day'",
        '2001-01-01 00:00:00',
        '2001-01-02 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('y2k for 1 week', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 1 week'",
        '2001-01-01 00:00:00',
        '2001-01-08 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('y2k for 1 month', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 1 month'",
        '2001-01-01 00:00:00',
        '2001-02-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('y2k for 1 quarter', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 1 quarter'",
        '2001-01-01 00:00:00',
        '2001-04-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('y2k for 1 year', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001 for 1 year'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('null', async () => {
      const rangeQuery = mkRangeQuery(
        "f'null'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, [{n: 'z-null'}]);
    });
    test('not null', async () => {
      const rangeQuery = mkRangeQuery(
        "f'not null'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, [
        {n: 'before'},
        {n: 'first'},
        {n: 'last'},
        {n: 'post-range'},
      ]);
    });
    test('empty temporal filter', async () => {
      const rangeQuery = mkRangeQuery(
        "f''",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, [
        {n: 'before'},
        {n: 'first'},
        {n: 'last'},
        {n: 'post-range'},
        {n: 'z-null'},
      ]);
    });
    test('year literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('not month literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'not 2001-06'",
        '2001-06-01 00:00:00',
        '2001-07-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, notInRange);
    });
    test('day literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001-06-15'",
        '2001-06-15 00:00:00',
        '2001-06-16 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('hour literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001-02-03 04'",
        '2001-02-03 04:00:00',
        '2001-02-03 05:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('minute literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001-02-03 04:05'",
        '2001-02-03 04:05:00',
        '2001-02-03 04:06:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('quarter literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2001-Q1'",
        '2001-01-01 00:00:00',
        '2001-04-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('week literal', async () => {
      const rangeQuery = mkRangeQuery(
        "f'2023-01-01-WK'",
        '2023-01-01 00:00:00',
        '2023-01-08 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
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
      const rangeQuery = mkRangeQuery(
        "f'today'",
        '2001-02-03 00:00:00',
        '2001-02-04 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('yesterday', async () => {
      nowIs('2001-02-03 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'yesterday'",
        '2001-02-02 00:00:00',
        '2001-02-03 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('tomorrow', async () => {
      nowIs('2001-02-03 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'tomorrow'",
        '2001-02-04 00:00:00',
        '2001-02-05 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('this week', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'this week'",
        '2023-01-01 00:00:00',
        '2023-01-08 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last month', async () => {
      nowIs('2001-02-01 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'last month'",
        '2001-01-01 00:00:00',
        '2001-02-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next quarter', async () => {
      nowIs('2001-01-02 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next quarter'",
        '2001-04-01 00:00:00',
        '2001-07-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('this year', async () => {
      nowIs('2001-01-02 12:00:00');
      const rangeQuery = mkRangeQuery(
        "f'this year'",
        '2001-01-01 00:00:00',
        '2002-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    // 2023-01-01 is a sunday
    test('(last) sunday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'sunday'",
        '2023-01-01 00:00:00',
        '2023-01-02 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last monday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'last monday'",
        '2023-01-02 00:00:00',
        '2023-01-03 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last-tuesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'tuesday'",
        '2022-12-27 00:00:00',
        '2022-12-28 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last-wednesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'wednesday'",
        '2022-12-28 00:00:00',
        '2022-12-29 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last-thursday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'thursday'",
        '2022-12-29 00:00:00',
        '2022-12-30 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last-friday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'friday'",
        '2022-12-30 00:00:00',
        '2022-12-31 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('last saturday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'last saturday'",
        '2022-12-31 00:00:00',
        '2023-01-01 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next sunday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next sunday'",
        '2023-01-08 00:00:00',
        '2023-01-09 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next monday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next monday'",
        '2023-01-09 00:00:00',
        '2023-01-10 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next tuesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next tuesday'",
        '2023-01-10 00:00:00',
        '2023-01-11 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next wednesday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next wednesday'",
        '2023-01-04 00:00:00',
        '2023-01-05 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next thursday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next thursday'",
        '2023-01-05 00:00:00',
        '2023-01-06 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next friday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next friday'",
        '2023-01-06 00:00:00',
        '2023-01-07 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('next saturday', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'next Saturday'",
        '2023-01-07 00:00:00',
        '2023-01-08 00:00:00'
      );
      await expect(rangeQuery).malloyResultMatches(db, inRange);
    });
    test('temporal filters are case insensitive', async () => {
      nowIs('2023-01-03 00:00:00');
      const rangeQuery = mkRangeQuery(
        "f'Null Or noT aFter TomoRRow'",
        '2023-01-04 00:00:00',
        '2023-01-05 00:00:00'
      );
      await expect(rangeQuery).matchesRows(
        db,
        {n: 'before'},
        {n: 'first'},
        {n: 'last'},
        {n: 'z-null'}
      );
    });
    const tzTesting = dbName !== 'presto' && dbName !== 'trino';
    describe('query time zone', () => {
      test.when(tzTesting)('day literal in query time zone', async () => {
        const rangeQuery = mkRangeQuery(
          "f'2024-01-01'",
          '2024-01-01 00:00:00',
          '2024-01-02 00:00:00',
          'America/Mexico_City'
        );
        await expect(rangeQuery).malloyResultMatches(db, inRange);
      });
      test.when(tzTesting)('day literal in query time zone', async () => {
        nowIs('2024-01-15 00:34:56', 'America/Mexico_City');
        const rangeQuery = mkRangeQuery(
          "f'today'",
          '2024-01-15 00:00:00',
          '2024-01-16 00:00:00',
          'America/Mexico_City'
        );
        await expect(rangeQuery).malloyResultMatches(db, inRange);
      });
      test.when(tzTesting)('day literal in query time zone', async () => {
        nowIs('2024-01-01 00:00:00', 'America/Mexico_City');
        const rangeQuery = mkRangeQuery(
          "f'next wednesday'",
          '2024-01-03 00:00:00',
          '2024-01-04 00:00:00',
          'America/Mexico_City'
        );
        await expect(rangeQuery).malloyResultMatches(db, inRange);
      });
      test.when(tzTesting)('day literal in query time zone', async () => {
        const exactTimeModel = mkEqTime('2024-01-15 12:00:00');
        await expect(`
          run: eqtime -> {
            timezone: 'America/Mexico_City'
            where: t ~ f'2024-01-15 06:00:00'  // 6 AM Mexico City = Noon UTC
            select: t, n
          }
        `).malloyResultMatches(exactTimeModel, {n: 'exact'});
      });
    });
  });
});
