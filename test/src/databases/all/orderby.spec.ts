/* eslint-disable no-console */
/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {booleanResult, databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const orderByModel = runtime.loadModel(`
    source: models is ${databaseName}.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`);

  it(`boolean type - ${databaseName}`, async () => {
    await expect(`
      run: models-> {
        group_by: big is seats >=20
        aggregate: model_count is count()
      }
    `).malloyResultMatches(orderByModel, {
      big: booleanResult(false, databaseName),
      model_count: 58451,
    });
  });

  it(`boolean in pipeline - ${databaseName}`, async () => {
    await expect(`
      run: models->{
        group_by:
          manufacturer,
          big is seats >=21
        aggregate: model_count is count()
      }->{
        group_by: big
        aggregate: model_count is model_count.sum()
      }
    `).malloyResultMatches(orderByModel, {
      big: booleanResult(false, databaseName),
      model_count: 58500,
    });
  });

  it(`filtered measures in model are aggregates #352 - ${databaseName}`, async () => {
    await expect(`
      run: models->{
        aggregate: j_names is model_count {where: manufacturer ~ 'J%'}
      } -> {
        group_by: j_names
      }
    `).malloyResultMatches(orderByModel, {j_names: 1358});
  });

  it(`reserved words are quoted - ${databaseName}`, async () => {
    await expect(`
      run: models->{
        aggregate: fetch is count()
      }->{
        group_by: fetch
      }
    `).malloyResultMatches(orderByModel, {});
  });

  test.when(runtime.supportsNesting)(
    `reserved words are quoted in turtles - ${databaseName}`,
    async () => {
      await expect(`
      run: ${databaseName}.table('malloytest.state_facts')->{
        nest: withx is {
          group_by: select is upper(popular_name)
          aggregate: fetch is count()
        }
      } -> {
        select:
          withxz is lower(withx.select)
          fetch is withx.fetch
      }
    `).malloyResultMatches(orderByModel, {});
    }
  );

  it.skip('reserved words in structure definitions', async () => {
    await expect(`
      run: models->{
        nest: withx is {
          group_by: is select is UPPER(manufacturer)
          aggregate: fetch is count()
        }
      } -> {
        select: withxis lower(withx.select)
        select: fetch is with.fetch
      }
    `).malloyResultMatches(orderByModel, {});
  });

  it(`aggregate and scalar conditions - ${databaseName}`, async () => {
    await expect(`
      run: models->{
        aggregate: model_count is count(){ where: manufacturer ? ~'A%' }
      }
    `).malloyResultMatches(orderByModel, {});
  });

  // I'm not sure I have the syntax right here...
  it(`modeled having simple - ${databaseName}`, async () => {
    await expect(`
      source: popular_names is models->{
        having: model_count > 100
        group_by: manufacturer
        aggregate: model_count
      }
      run: popular_names->{
        order_by: 2
        select: manufacturer, model_count
      }
    `).malloyResultMatches(orderByModel, {model_count: 102});
  });

  test.when(runtime.supportsNesting)(
    `modeled having complex - ${databaseName}`,
    async () => {
      await expect(`
        source: popular_names is models->{
          having: model_count > 100
          group_by: manufacturer
          aggregate: model_count
          nest: l is {
            top: 5
            group_by: manufacturer
            aggregate: model_count
          }
        }
        run: popular_names->{
          order_by: 2
          select: manufacturer, model_count
        }
      `).malloyResultMatches(orderByModel, {model_count: 102});
    }
  );

  it(`turtle references joined element - ${databaseName}`, async () => {
    await expect(`
      source: a is ${databaseName}.table('malloytest.aircraft') extend {
        primary_key: tail_num
        measure: aircraft_count is count()
      }

      run: ${databaseName}.table('malloytest.flights') extend {
        primary_key: id2
        join_one: a with tail_num

        measure: flight_count is count()
        view: foo is {
          group_by: carrier
          aggregate: flight_count
          aggregate: a.aircraft_count
        }
      } -> foo
    `).malloyResultMatches(orderByModel, {});
  });

  // There's a problem with null ordering in MySQL which we are ignoring for now
  const testNullOrdering = databaseName !== 'mysql';
  const testTimes = testNullOrdering && databaseName !== 'presto';
  describe('null ordering', () => {
    const q = runtime.getQuoter();
    const a = runtime.dialect.sqlLiteralString('a');
    const b = runtime.dialect.sqlLiteralString('b');
    const c = runtime.dialect.sqlLiteralString('c');
    const az = `${databaseName}.sql("""
      SELECT ${a} as ${q`l`}, 'a' as ${q`ln`}
      UNION ALL SELECT ${c}, 'c'
      UNION ALL SELECT ${b}, 'b'
      UNION ALL SELECT NULL, 'null'
    """)`;
    test.when(testNullOrdering)(
      'null last in select string with ascending order',
      async () => {
        await expect(
          `run: ${az} -> { select: *; order_by: l asc }`
        ).malloyResultMatches(runtime, [
          {ln: 'a'},
          {ln: 'b'},
          {ln: 'c'},
          {ln: 'null'},
        ]);
      }
    );
    test.when(testNullOrdering)(
      'null last in select string with descending order',
      async () => {
        await expect(
          `run: ${az} -> { select: *; order_by: l desc }`
        ).malloyResultMatches(runtime, [
          {ln: 'c'},
          {ln: 'b'},
          {ln: 'a'},
          {ln: 'null'},
        ]);
      }
    );
    test.when(testNullOrdering)(
      'null last in reduce string with default ascending order',
      async () => {
        await expect(`
        #! test.verbose
        run: ${az} -> { group_by: l }`).malloyResultMatches(runtime, [
          {l: 'a'},
          {l: 'b'},
          {l: 'c'},
          {l: null},
        ]);
      }
    );
    const nums = `${databaseName}.sql("""
      SELECT 1 as ${q`n`}
      UNION ALL SELECT 9
      UNION ALL SELECT 5
      UNION ALL SELECT NULL
      """)`;
    test.when(testNullOrdering)(
      'null last in numbers with ascending order',
      async () => {
        await expect(
          `run: ${nums} -> { select: n; order_by: n asc }`
        ).malloyResultMatches(runtime, [{n: 1}, {n: 5}, {n: 9}, {n: null}]);
      }
    );
    test.when(testNullOrdering)(
      'null last in numbers with descending order',
      async () => {
        await expect(
          `run: ${nums} -> { select: n; order_by: n desc }`
        ).malloyResultMatches(runtime, [{n: 9}, {n: 5}, {n: 1}, {n: null}]);
      }
    );
    test.when(testNullOrdering)(
      'null last in reduce measure with default descending order',
      async () => {
        await expect(`
        # test.verbose
        run: ${nums} -> {
          group_by: nstr is n ? pick 'null' when is null else concat('number', n::string)
          aggregate: nTotal is n.sum()
        }`).malloyResultMatches(runtime, [
          {nstr: 'number9'},
          {nstr: 'number5'},
          {nstr: 'number1'},
          {nstr: 'null'},
        ]);
      }
    );
    const y2020 = runtime.dialect.sqlLiteralTime(
      {},
      {
        node: 'timeLiteral',
        literal: '2020-01-01 00:00:00',
        typeDef: {type: 'timestamp'},
      }
    );
    const d2020 = new Date('2020-01-01 00:00:00Z');
    const d2022 = new Date('2022-01-01 00:00:00Z');
    const d2025 = new Date('2025-01-01 00:00:00Z');
    const y2025 = runtime.dialect.sqlLiteralTime(
      {},
      {
        node: 'timeLiteral',
        literal: '2025-01-01 00:00:00',
        typeDef: {type: 'timestamp'},
      }
    );
    const y2022 = runtime.dialect.sqlLiteralTime(
      {},
      {
        node: 'timeLiteral',
        literal: '2022-01-01 00:00:00',
        typeDef: {type: 'timestamp'},
      }
    );
    const times = `${databaseName}.sql("""
      SELECT ${y2020} as ${q`t`}
      UNION ALL SELECT ${y2025}
      UNION ALL SELECT ${y2022}
      UNION ALL SELECT NULL
    """)`;
    test.when(testTimes)(
      'null last in timestamps with ascending order',
      async () => {
        await expect(
          `run: ${times} -> { select: t; order_by: t asc }`
        ).malloyResultMatches(runtime, [
          {t: d2020},
          {t: d2022},
          {t: d2025},
          {t: null},
        ]);
      }
    );
    test.when(testTimes)(
      'null last in timestamps with descending order',
      async () => {
        await expect(
          `run: ${times} -> { select: t; order_by: t desc }`
        ).malloyResultMatches(runtime, [
          {t: d2025},
          {t: d2022},
          {t: d2020},
          {t: null},
        ]);
      }
    );
    test.when(testTimes)(
      'null last in reduce timestamps with default descending order',
      async () => {
        await expect(`run: ${times} -> { group_by: t }`).malloyResultMatches(
          runtime,
          [{t: d2025}, {t: d2022}, {t: d2020}, {t: null}]
        );
      }
    );
  });
});
