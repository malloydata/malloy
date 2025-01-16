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

import {AtomicTypeDef, FieldDef} from '@malloydata/malloy';
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
      expect(connection.malloyTypeFromTrinoType('test', ARRAY_SCHEMA)).toEqual({
        type: 'array',
        elementTypeDef: intType,
      });
    });

    it('parses inline', () => {
      expect(connection.malloyTypeFromTrinoType('test', INLINE_SCHEMA)).toEqual(
        {
          'type': 'record',
          'fields': recordSchema,
        }
      );
    });

    it('parses nested', () => {
      expect(connection.malloyTypeFromTrinoType('test', NESTED_SCHEMA)).toEqual(
        {
          'type': 'array',
          'elementTypeDef': {type: 'record_element'},
          'fields': recordSchema,
        }
      );
    });

    it('parses a simple type', () => {
      expect(connection.malloyTypeFromTrinoType('test', 'varchar(60)')).toEqual(
        stringType
      );
    });

    it('parses deep nesting', () => {
      expect(connection.malloyTypeFromTrinoType('test', DEEP_SCHEMA)).toEqual({
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
  });
});
