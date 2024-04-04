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

import {TrinoConnection, TrinoExecutor} from '.';

// Array(varchar) is array
const ARRAY_SCHEMA = 'array(integer)';

// Row(...) is inline
const INLINE_SCHEMA = 'row(a double, b integer, c varchar(60))';

// Array(row(....)) is nested
const NESTED_SCHEMA = 'array(row(a double, b integer, c varchar(60)))';

describe('Trino connection', () => {
  let connection: TrinoConnection;

  beforeAll(() => {
    connection = new TrinoConnection(
      'trino',
      {},
      TrinoExecutor.getConnectionOptionsFromEnv()
    );
  });

  afterAll(() => {
    connection.close();
  });

  describe('schema parser', () => {
    it('parses arrays', () => {
      expect(connection.malloyTypeFromTrinoType('test', ARRAY_SCHEMA)).toEqual({
        'name': 'test',
        'type': 'struct',
        'dialect': 'trino',
        'structRelationship': {
          'fieldName': 'test',
          'isArray': true,
          'type': 'nested',
        },
        'structSource': {
          'type': 'nested',
        },
        'fields': [
          {
            'name': 'value',
            'type': 'number',
            'numberType': 'integer',
          },
        ],
      });
    });

    it('parses inline', () => {
      expect(connection.malloyTypeFromTrinoType('test', INLINE_SCHEMA)).toEqual(
        {
          'name': 'test',
          'type': 'struct',
          'dialect': 'trino',
          'structRelationship': {
            'type': 'inline',
          },
          'structSource': {
            'type': 'inline',
          },
          'fields': [
            {
              'name': 'a',
              'type': 'number',
              'numberType': 'float',
            },
            {
              'name': 'b',
              'type': 'number',
              'numberType': 'integer',
            },
            {
              'name': 'c',
              'type': 'string',
            },
          ],
        }
      );
    });

    it('parses nested', () => {
      expect(connection.malloyTypeFromTrinoType('test', NESTED_SCHEMA)).toEqual(
        {
          'name': 'test',
          'type': 'struct',
          'dialect': 'trino',
          'structRelationship': {
            'fieldName': 'test',
            'isArray': true,
            'type': 'nested',
          },
          'structSource': {'type': 'nested'},
          'fields': [
            {'name': 'a', 'numberType': 'float', 'type': 'number'},
            {'name': 'b', 'numberType': 'integer', 'type': 'number'},
            {'name': 'c', 'type': 'string'},
          ],
        }
      );
    });

    it('parses a simple type', () => {
      expect(connection.malloyTypeFromTrinoType('test', 'varchar(60)')).toEqual(
        {
          'type': 'string',
        }
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
