/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel, mkTestModel} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';
import {mkSqlEqWith} from '../util';

afterAll(() => testDatabase.shutdown());

const modelText = `
source: aircraft_models is db.table('malloytest.aircraft_models') extend {
  primary_key: aircraft_model_code
  measure:
    aircraft_model_count is count(),
    total_seats is sum(seats),
    boeing_seats is sum(seats) { where: manufacturer ? 'BOEING'},
    percent_boeing is boeing_seats / total_seats * 100,
    percent_boeing_floor is floor(boeing_seats / total_seats * 100),
  dimension: seats_bucketed is floor(seats/20)*20.0
}

source: aircraft is db.table('malloytest.aircraft') extend {
  primary_key: tail_num
  join_one: aircraft_models with aircraft_model_code
  measure: aircraft_count is count()
  view: by_manufacturer is {
    top: 5
    group_by: aircraft_models.manufacturer
    aggregate: aircraft_count
  }
}
`;
const testModel = wrapTestModel(testDatabase, modelText);

const q = (x: TemplateStringsArray) =>
  testDatabase.dialect.sqlQuoteIdentifier(x.toString());

const nativeInt = testDatabase.name === 'mysql' ? 'signed' : 'integer';

const emptyModel = wrapTestModel(testDatabase, '');
const sqlEq = mkSqlEqWith(testDatabase.runtime, 'db', {
  malloy: `extend {
      dimension: friName is 'friday'
      dimension: friDay is 5
      dimension: satName is 'saturday'
      dimension: satDay is 6
    }`,
});

it('computes mod correctly', async () => {
  await expect(`
      run: db.sql("SELECT 10 as ten") -> {select: mod is 10 % 3}
    `).toMatchResult(testModel, {mod: 1});
});
it('sql cast', async () => {
  await expect(`
      run: aircraft -> {
        group_by: a is "312"::"${nativeInt}"
      }
    `).toMatchResult(testModel, {a: 312});
});

it('case expressions', async () => {
  await expect(`
      run: aircraft_models -> {
        where: manufacturer ? 'BOEING' | 'CESSNA'
        group_by:
          other is case when manufacturer = 'BOEING' then 'BOEING' else 'OTHER' end
        group_by:
          nully is case when manufacturer = 'BOEING' then 'BOEING' end
        group_by:
          valuey is case manufacturer when 'BOEING' then 'BOEING' else 'NOT BOEING' end
      }
    `).toEqualResult(testModel, [
    {other: 'BOEING', nully: 'BOEING', valuey: 'BOEING'},
    {other: 'OTHER', nully: null, valuey: 'NOT BOEING'},
  ]);
});

it('sql safe cast', async () => {
  const safeCast = `
      run: db.sql('SELECT 1 as one') -> { select:
        bad_date is '12a':::date
        bad_number is 'abc':::number
        good_number is "312":::"${nativeInt}"
      }
    `;
  if (testDatabase.dialect.supportsSafeCast) {
    await expect(safeCast).toMatchResult(testModel, {
      bad_date: null,
      bad_number: null,
      good_number: 312,
    });
  } else {
    await expect(safeCast).toEmitDuringTranslation(testDatabase.runtime, {
      id: 'translation-error',
      data: {code: 'dialect-cast-unsafe-only'},
    });
  }
});
test('basic like', async () => {
  const result = await sqlEq("'abz' ~ '%z'", true);
  expect(result).isSqlEq();
});
test('basic like with string', async () => {
  const result = await sqlEq("'%' ~ '\\\\%'", true);
  expect(result).isSqlEq();
});
test('basic like with raw string', async () => {
  const result = await sqlEq("'%' ~ s'\\%'", true);
  expect(result).isSqlEq();
});

describe.skip('alternations with not-eq', () => {
  /*
     Here's the desired truth table ...

     x      x != y | z
     ====== ============
     y      false
     z      false
     ^[yz]  true
     */
  test('x not-eq y or z : x eq y', async () => {
    const result = await sqlEq('6 != (6|7)', false);
    expect(result).isSqlEq();
  });
  test('x not-eq y or z : x eq z', async () => {
    const result = await sqlEq('7 != (6|7)', false);
    expect(result).isSqlEq();
  });
  test('x not-eq y or z : else', async () => {
    const result = await sqlEq('5 != (6|7)', true);
    expect(result).isSqlEq();
  });
  /*
      Writing this the old way, should have the same truth table ...
        x != y & != z
    */
  test('x not-eq y and not-eq z : x eq y', async () => {
    const result = await sqlEq('6 != (6 & !=7)', false);
    expect(result).isSqlEq();
  });
  test('x not-eq y and not-eq z : x eq z', async () => {
    const result = await sqlEq('7 != (6 & != 7)', false);
    expect(result).isSqlEq();
  });
  test('x not-eq y and not-eq z : else', async () => {
    const result = await sqlEq('5 != (6 & !=7)', true);
    expect(result).isSqlEq();
  });
});

test('nullish ?? operator', async () => {
  await expect(
    `run: db.sql("""
          SELECT '' as ${q`null_value`}, '' as ${q`string_value`}
          UNION ALL SELECT null, 'correct'
      """) -> {
        where: null_value is null
        select:
          found_null is  null_value ?? 'correct',
          else_pass is string_value ?? 'incorrect'
          literal_null is null ?? 'correct'
      }`
  ).toMatchResult(emptyModel, {
    found_null: 'correct',
    else_pass: 'correct',
    literal_null: 'correct',
  });
});

if (testDatabase.dialect.booleanType !== 'none') {
  describe('null safe booleans', () => {
    const nulls = `db.sql("""
        SELECT
          0 as ${q`n`},
          1 as ${q`x`}, 2 as ${q`y`},
          'a' as ${q`a`}, 'b' as ${q`b`},
          (1=1) as ${q`tf`}
        UNION ALL SELECT
          5,
          null, null, null, null, null
      """) extend { where: n > 0 }`;

    it('select boolean', async () => {
      await expect(`run: ${nulls} -> {
          select:
            null_boolean is tf
        }`).toMatchResult(emptyModel, {null_boolean: null});
    });
    it('not boolean', async () => {
      await expect(`run: ${nulls} -> {
          select:
            not_null_boolean is not tf
        }`).toMatchResult(emptyModel, {not_null_boolean: true});
    });
    it('numeric != non-null to null', async () => {
      await expect(
        `run: ${nulls} -> { select: val_ne_null is x != 9 }`
      ).toMatchResult(emptyModel, {val_ne_null: true});
    });
    it('string !~ non-null to null', async () => {
      await expect(
        `run: ${nulls} -> { select: val_ne_null is a !~ 'z' }`
      ).toMatchResult(emptyModel, {val_ne_null: true});
    });
    it('regex !~ non-null to null', async () => {
      await expect(
        `run: ${nulls} -> { select: val_ne_null is a !~ r'z' }`
      ).toMatchResult(emptyModel, {val_ne_null: true});
    });
    it('numeric != null-to-null', async () => {
      await expect(
        `run: ${nulls} -> { select: null_ne_null is x != y }`
      ).toMatchResult(emptyModel, {null_ne_null: true});
    });
    it('string !~ null-to-null', async () => {
      await expect(
        `run: ${nulls} -> { select: null_ne_null is a !~ b }`
      ).toMatchResult(emptyModel, {null_ne_null: true});
    });
  });
}

test('dimension expressions expanded with parens properly', async () => {
  await expect(
    `run: db.sql("SELECT 1 as one") extend {
        dimension: fot is (false) or (true)
      } -> {
        select:
          no_paren is pick 'yes' when false and fot else 'no'
          paren is    pick 'yes' when false and (fot) else 'no'
      }`
  ).toMatchResult(emptyModel, {
    paren: 'no',
    no_paren: 'no',
  });
});

describe('an operand with one operand of its own keeps its grouping', () => {
  const tm = mkTestModel(testDatabase, {nums: [{a: 7, c: 2}]});

  test('negation beside a minus', async () => {
    await expect(`run: nums -> {
        select:
          minus_paren_neg is c - (-a)
          minus_neg is c - -a
          neg_paren_neg is -(-a)
          neg_neg is - -a
      }`).toMatchResult(tm, {
      minus_paren_neg: 9,
      minus_neg: 9,
      neg_paren_neg: 7,
      neg_neg: 7,
    });
  });

  test.when(testDatabase.dialect.booleanType !== 'none')(
    'a null check on the right of =',
    async () => {
      await expect(`run: nums -> {
          select:
            is_null is pick 'yes' when (a = 1) = (c is null) else 'no'
            is_not_null is pick 'yes' when (a = 1) = (c is not null) else 'no'
        }`).toMatchResult(tm, {is_null: 'yes', is_not_null: 'no'});
    }
  );
});

describe('an expression written into other SQL keeps its grouping', () => {
  const tm = mkTestModel(testDatabase, {nums: [{a: 7, c: 2}]});

  test('as the argument of a function', async () => {
    await expect(`run: nums -> {
        select:
          paren_divisor is div(10, (c + 3))
          bare_divisor is div(10, c + 3)
          dividend is div(a - 1, c)
      }`).toMatchResult(tm, {paren_divisor: 2, bare_divisor: 2, dividend: 3});
  });

  test('as a computed field of a nested select', async () => {
    await expect(`run: nums -> {
        group_by: a
        nest: n is { select: m is a % c }
      }`).toMatchResult(tm, {a: 7, n: [{m: 1}]});
  });

  test('as the value of a parameter', async () => {
    await expect(`
        ##! experimental.parameters
        source: nums_p(neg :: number is -5, diff :: number is 1 - 2) is nums extend {
          dimension:
            minus_neg is c - neg
            times_diff is c * diff
        }
        run: nums_p -> { select: minus_neg, times_diff }
      `).toMatchResult(tm, {minus_neg: 7, times_diff: -2});
  });

  test('as the value of a given', async () => {
    await expect(`
        ##! experimental.givens
        given: NEG :: number is -5
        given: DIFF :: number is 1 - 2
        run: nums -> {
          select:
            minus_neg is c - $NEG
            times_diff is c * $DIFF
        }
      `).toMatchResult(tm, {minus_neg: 7, times_diff: -2});
  });
});

it('regexp match', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.sql("""
        SELECT 'hello mom' as ${q`a`}, 'cheese tastes good' as ${q`b`}
        UNION ALL SELECT 'lloyd is a bozo', 'michael likes poetry'
      """) -> {
        aggregate: llo is count() {where: a ~ r'llo'}
        aggregate: m2 is count() {where: a !~ r'bozo'}
      }
    `).toMatchResult(testModel, {llo: 2, m2: 1});
});

it('substitution precedence', async () => {
  const testModel = wrapTestModel(testDatabase, '');
  await expect(`
      run: db.sql("""
        SELECT 5 as ${q`a`}, 2 as ${q`b`}
        UNION ALL SELECT 3, 4
      """) -> {
        extend: {dimension:  c is b + 4}
        select: x is  a * c
        order_by: x desc
      }
      `).toMatchResult(testModel, {x: 30});
});
