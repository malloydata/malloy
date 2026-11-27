/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel, mkTestModel} from '@malloydata/malloy/test';
import '../util/db-jest-matchers';

import type {AtomicTypeDef} from '@malloydata/malloy';

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

test.when(testDatabase.dialect.supportsBigIntPrecision)(
  'number sizes',
  async () => {
    const MAX_INT64 = BigInt('9223372036854775807');
    const tm = mkTestModel(testDatabase, {
      oneBigNum: [{bign: MAX_INT64, n: 1}],
    });
    await expect('run: oneBigNum->{select: bign, n}').toMatchResult(tm, {
      bign: MAX_INT64,
      n: 1,
    });
  }
);

test('aggregate number size', async () => {
  // on some databases sumI() expands to a larger integer type
  // which cuased this to fail.
  await expect('run: aircraft_models->{aggregate: total_seats}').toMatchResult(
    testModel,
    {total_seats: 452415}
  );
});

const orderByModel = wrapTestModel(
  testDatabase,
  `
    source: models is db.table('malloytest.aircraft_models') extend {
      measure: model_count is count()
    }`
);

// A dialect without boolean values cannot group by one
it.when(testDatabase.dialect.booleanType !== 'none')(
  'boolean type',
  async () => {
    await expect(`
      run: models-> {
        group_by: big is seats >=20
        aggregate: model_count is count()
      }
    `).toMatchResult(orderByModel, {
      big: false,
      model_count: 58451,
    });
  }
);

it.when(testDatabase.dialect.booleanType !== 'none')(
  'boolean in pipeline',
  async () => {
    await expect(`
      run: models->{
        group_by:
          manufacturer,
          big is seats >= 21
        aggregate: model_count is count()
      } -> {
        group_by: big
        aggregate: model_count is model_count.sum()
      }
    `).toMatchResult(orderByModel, {
      big: false,
      model_count: 58500,
    });
  }
);

const basicTypes: {name: string; typeDef: AtomicTypeDef; skip?: string[]}[] = [
  {name: 'string', typeDef: {type: 'string'}},
  {
    name: 'integer',
    typeDef: {type: 'number', numberType: 'integer'},
    skip: ['bigquery', 'mysql', 'snowflake'],
  },
  {name: 'float', typeDef: {type: 'number', numberType: 'float'}},
  {
    name: 'bigint',
    typeDef: {type: 'number', numberType: 'bigint'},
    skip: ['mysql'],
  },
  {name: 'boolean', typeDef: {type: 'boolean'}, skip: ['mysql']},
  {name: 'date', typeDef: {type: 'date'}},
  {name: 'timestamp', typeDef: {type: 'timestamp'}},
  {
    name: 'timestamptz',
    typeDef: {type: 'timestamptz'},
  },
];

const dialect = testDatabase.dialect;

describe('basic type roundtrip', () => {
  for (const {name, typeDef, skip} of basicTypes) {
    let shouldRun = !skip?.includes(testDatabase.name);
    if (typeDef.type === 'timestamptz') {
      shouldRun = dialect.hasTimestamptz;
    }
    test.when(shouldRun)(name, () => {
      const sql = dialect.malloyTypeToSQLType(typeDef);
      const result = dialect.sqlTypeToMalloyType(sql);
      expect(result).toEqual(typeDef);
    });
  }
});
