/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';
import type {AtomicTypeDef} from '@malloydata/malloy';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

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
    skip: ['bigquery', 'postgres', 'mysql'],
  },
];

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  const dialect = runtime.dialect;

  describe('basic type roundtrip', () => {
    for (const {name, typeDef, skip} of basicTypes) {
      const shouldRun = !skip?.includes(databaseName);
      test.when(shouldRun)(name, () => {
        const sql = dialect.malloyTypeToSQLType(typeDef);
        const result = dialect.sqlTypeToMalloyType(sql);
        expect(result).toEqual(typeDef);
      });
    }
  });

  describe('compound type cast', () => {
    const testModel = wrapTestModel(runtime, '');
    const one = `${databaseName}.sql("SELECT 1 as n")`;

    const compoundCasts: {
      name: string;
      castType: string;
      isArray?: boolean;
      skip?: string[];
    }[] = [
      {name: 'number[]', castType: 'number[]', isArray: true},
      {
        name: '{a :: number, b :: string}',
        castType: '{a :: number, b :: string}',
        skip: ['postgres'],
      },
      {
        name: '{a :: number, b :: string}[]',
        castType: '{a :: number, b :: string}[]',
        isArray: true,
        skip: ['postgres'],
      },
      {
        name: '{a :: number, b :: string[]}',
        castType: '{a :: number, b :: string[]}',
        skip: ['postgres'],
      },
    ];

    const arrayCoercesToEmpty = ['bigquery'];

    for (const {name, castType, isArray, skip} of compoundCasts) {
      const shouldRun = !skip?.includes(databaseName);
      test.when(shouldRun)(`null::${name}`, async () => {
        // Some databases coerce CAST(NULL AS ARRAY<...>) to empty array
        const expected =
          isArray && arrayCoercesToEmpty.includes(databaseName) ? [] : null;
        await expect(`
          run: ${one} -> { select: v is null::${castType} }
        `).toMatchResult(testModel, {v: expected});
      });
    }
  });
});
