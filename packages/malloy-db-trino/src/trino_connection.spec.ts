/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicTypeDef, FieldDef} from '@malloydata/malloy';
import {TrinoConnection, TrinoExecutor} from '.';

// array(varchar) is array
const ARRAY_SCHEMA = 'array(integer)';

// row(...) is inline
const INLINE_SCHEMA = 'row(a double, b integer, c varchar(60))';

// array(row(....)) is nested
const NESTED_SCHEMA = 'array(row(a double, b integer, c varchar(60)))';

// array(row(..., array(row(....)))) is deeply nested
const DEEP_SCHEMA =
  'array(row(a double, b array(row(c integer, d varchar(60)))))';

const intType: AtomicTypeDef = {type: 'number', numberType: 'integer'};
const doubleType: AtomicTypeDef = {type: 'number', numberType: 'float'};
const stringType: AtomicTypeDef = {type: 'string'};
const recordSchema: FieldDef[] = [
  {name: 'a', ...doubleType},
  {name: 'b', ...intType},
  {name: 'c', ...stringType},
];

describe('Trino connection', () => {
  let connection: TrinoConnection;

  beforeAll(() => {
    connection = new TrinoConnection(
      'trino',
      {},
      TrinoExecutor.getConnectionOptionsFromEnv('trino')
    );
  });

  afterAll(() => {
    connection.close();
  });

  describe('schema parser', () => {
    it('parses arrays', () => {
      expect(connection.malloyTypeFromTrinoType(ARRAY_SCHEMA)).toEqual({
        type: 'array',
        elementTypeDef: intType,
      });
    });

    it('parses inline', () => {
      expect(connection.malloyTypeFromTrinoType(INLINE_SCHEMA)).toEqual({
        'type': 'record',
        'fields': recordSchema,
      });
    });

    it('parses nested', () => {
      expect(connection.malloyTypeFromTrinoType(NESTED_SCHEMA)).toEqual({
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'fields': recordSchema,
      });
    });

    it('parses a simple type', () => {
      expect(connection.malloyTypeFromTrinoType('varchar(60)')).toEqual(
        stringType
      );
    });

    it('parses a decimal integer type', () => {
      expect(connection.malloyTypeFromTrinoType('decimal(10)')).toEqual({
        type: 'number',
        numberType: 'integer',
      });
    });

    it('parses a decimal float type', () => {
      expect(connection.malloyTypeFromTrinoType('decimal(10,10)')).toEqual({
        type: 'number',
        numberType: 'float',
      });
    });

    it('parses row with timestamp(3)', () => {
      expect(
        connection.malloyTypeFromTrinoType('row(la_time timestamp(3))')
      ).toEqual({
        type: 'record',
        fields: [{name: 'la_time', type: 'timestamp'}],
      });
    });

    it('parses timestamp with time zone', () => {
      expect(
        connection.malloyTypeFromTrinoType('timestamp(3) with time zone)')
      ).toEqual({type: 'timestamptz'});
    });

    it('parses deep nesting', () => {
      expect(connection.malloyTypeFromTrinoType(DEEP_SCHEMA)).toEqual({
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'fields': [
          {'name': 'a', ...doubleType},
          {
            'name': 'b',
            'type': 'array',
            'elementTypeDef': {type: 'record_element'},
            'join': 'many',
            'fields': [
              {'name': 'c', ...intType},
              {'name': 'd', ...stringType},
            ],
          },
        ],
      });
    });

    describe('integer type mappings', () => {
      it('maps integer to integer', () => {
        expect(connection.malloyTypeFromTrinoType('integer')).toEqual({
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps smallint to integer', () => {
        expect(connection.malloyTypeFromTrinoType('smallint')).toEqual({
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps tinyint to integer', () => {
        expect(connection.malloyTypeFromTrinoType('tinyint')).toEqual({
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps bigint to bigint', () => {
        expect(connection.malloyTypeFromTrinoType('bigint')).toEqual({
          type: 'number',
          numberType: 'bigint',
        });
      });
    });
  });
});
