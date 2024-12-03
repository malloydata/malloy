/*
 * Copyright 2024 Google LLC
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

import {AtomicTypeDef, mkFieldDefFromType} from '@malloydata/malloy';
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
const recordSchema = {
  a: doubleType,
  b: intType,
  c: stringType,
};

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
      expect(connection.malloyTypeFromTrinoType('test', ARRAY_SCHEMA)).toEqual(
        mkFieldDefFromType(
          {type: 'array', elementTypeDef: intType},
          'test',
          'trino'
        )
      );
    });

    it('parses inline', () => {
      expect(connection.malloyTypeFromTrinoType('test', INLINE_SCHEMA)).toEqual(
        mkFieldDefFromType(
          {type: 'record', schema: recordSchema},
          'test',
          'trino'
        )
      );
    });

    it('parses nested', () => {
      expect(connection.malloyTypeFromTrinoType('test', NESTED_SCHEMA)).toEqual(
        mkFieldDefFromType(
          {
            type: 'array',
            elementTypeDef: {type: 'record', schema: recordSchema},
          },
          'test',
          'trino'
        )
      );
    });

    it('parses a simple type', () => {
      expect(connection.malloyTypeFromTrinoType('test', 'varchar(60)')).toEqual(
        stringType
      );
    });

    it('parses deep nesting', () => {
      expect(connection.malloyTypeFromTrinoType('test', DEEP_SCHEMA)).toEqual(
        mkFieldDefFromType(
          {
            type: 'array',
            elementTypeDef: {
              type: 'record',
              schema: {
                a: doubleType,
                b: {
                  type: 'array',
                  elementTypeDef: {
                    type: 'record',
                    schema: {
                      c: intType,
                      d: stringType,
                    },
                  },
                },
              },
            },
          },
          'test',
          'trino'
        )
      );
    });
  });

  describe('splitColumns', () => {
    it('handles internal rows', () => {
      const nested =
        'popular_name varchar, airport_count double, by_state array(row(state varchar, airport_count double))';

      expect(connection.splitColumns(nested)).toEqual([
        'popular_name varchar',
        'airport_count double',
        'by_state array(row(state varchar, airport_count double))',
      ]);
    });
  });
});
