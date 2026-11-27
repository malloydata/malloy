/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import {testDatabase} from '../test_database';

afterAll(() => testDatabase.shutdown());

const testModel = wrapTestModel(testDatabase, '');

it('accepts all schema numbers', async () => {
  const allNumeric = [
    'BIGINT',
    'DOUBLE',
    'FLOAT',
    'FLOAT4',
    'FLOAT8',
    'HUGEINT',
    'INT',
    'INT1',
    'INT2',
    'INT4',
    'INT8',
    'INTEGER',
    'LONG',
    'REAL',
    'SHORT',
    'SIGNED',
    'SMALLINT',
    'TINYINT',
    'UBIGINT',
    'UINTEGER',
    'USMALLINT',
    'UTINYINT',
  ];
  const allFields = allNumeric.map(numType => `a${numType.toLowerCase()}`);
  const query = `
      run: db.sql("""
        SELECT
        ${allNumeric
          .map(numType => `1::${numType} as a${numType.toLowerCase()}`)
          .join(',\n')}
      """) -> {
        aggregate:
        ${allFields
          .map(fieldType => `sum_${fieldType} is sum(${fieldType})`)
          .join('\n')}
      }
    `;
  await expect(query).toMatchResult(
    testModel,
    allNumeric.reduce<Record<string, number>>((building, ent) => {
      building[`sum_a${ent.toLowerCase()}`] = 1;
      return building;
    }, {})
  );
});

it('supports varchars with parameters', async () => {
  await expect(
    "run: db.sql(\"SELECT 'a'::VARCHAR as abc, 'a3'::VARCHAR(3) as abc3\")"
  ).toMatchResult(testModel, {abc: 'a', abc3: 'a3'});
});
