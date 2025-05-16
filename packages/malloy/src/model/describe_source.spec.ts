/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {describeSource} from '../api/core';
import type {DescribeSourceResponse} from './describe_source';

describe('describe_source', () => {
  describe('sql artifact filters from a source', () => {
    test('extended source with a single table dependency', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const result = describeSource({
        model_url: 'file://test.malloy',
        source_name: 'flights',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights') extend {
                  rename: start is origin
                  except: carrier
                  where: destination = 'ohio'
                  dimension:
                    one is 1
                    two is destination
                    three is two
                    four is concat(two, '-', three)
                    trip is concat(start, '-', destination)
                }
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });
      const expected: DescribeSourceResponse = {
        sql_artifacts: [
          {
            name: 'flights',
            columns: [{name: 'destination'}, {name: 'origin'}],
            filters: [{sql: "(destination='ohio')"}],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('extended source with filters', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const result = describeSource({
        model_url: 'file://test.malloy',
        source_name: 'flights',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights') extend {
                  rename: start is origin
                  except: carrier
                  where: three = 'ohio'
                    and start = 'ohio'
                  dimension:
                    one is 1
                    two is destination
                    three is two
                    four is concat(two, '-', three)
                    trip is concat(start, '-', destination)
                }
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });
      const expected: DescribeSourceResponse = {
        sql_artifacts: [
          {
            name: 'flights',
            columns: [{name: 'destination'}, {name: 'origin'}],
            filters: [{sql: "((destination='ohio') and (origin='ohio'))"}],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('source with a sql query dependency', () => {
      const sql = 'SELECT carrier FROM flights';
      const carrierSQL: Malloy.SQLQuery = {
        connection_name: 'connection',
        sql,
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const result = describeSource({
        model_url: 'file://test.malloy',
        source_name: 'sql_source',
        compiler_needs: {
          sql_schemas: [carrierSQL],
          connections: [{name: 'connection', dialect: 'presto'}],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: sql_source is connection.sql('SELECT carrier FROM flights')
              `,
            },
          ],
        },
      });

      const expected: DescribeSourceResponse = {
        sql_artifacts: [
          {
            sql,
            columns: [{name: 'carrier'}],
            filters: [],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('source with join', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const sql = 'SELECT carrier, year_founded FROM carriers';
      const carrierSQL: Malloy.SQLQuery = {
        connection_name: 'connection',
        sql,
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'year_founded',
              type: {kind: 'number_type'},
            },
          ],
        },
      };

      const result = describeSource({
        model_url: 'file://test.malloy',
        source_name: 'flights_with_carrier_dim',
        compiler_needs: {
          table_schemas: [flightsTable],
          sql_schemas: [carrierSQL],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights')
                source: carriers is connection.sql('${sql}')

                source: flights_with_carrier_dim is flights extend {
                  join_many: carriers on carrier = carriers.carrier
                }
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });

      const expected: DescribeSourceResponse = {
        sql_artifacts: [
          {
            name: 'flights',
            columns: [
              {name: 'carrier'},
              {name: 'origin'},
              {name: 'destination'},
            ],
            filters: [],
          },
          {
            sql,
            columns: [{name: 'carrier'}, {name: 'year_founded'}],
            filters: [],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('source with pipeline', () => {
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'other',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const result = describeSource({
        model_url: 'file://test.malloy',
        source_name: 'derived3',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                source: flights is connection.table('flights')

                source: derived is flights extend {
                where: carrier = 'UA'} -> {select: start is origin \n where: origin = 'here' }

                source: derived2 is flights extend {
                where: carrier = 'UA'} -> {select: start is origin, destination} -> {select: start, destination } extend {
                  except: destination
                }

                source: derived3 is derived extend {
                  dimension:
                    begin is start
                    other is "other"
                } -> {select: begin \n where: other = "other"}
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });

      const expected: DescribeSourceResponse = {
        sql_artifacts: [
          {
            name: 'flights',
            columns: [{name: 'origin'}, {name: 'carrier'}],
            filters: [{sql: "(origin='here')"}, {sql: "(carrier='UA')"}],
          },
        ],
      };

      expect(result).toMatchObject(expected);
    });
    test('composite source', () => {
      // TODO: support composite sources
      const flightsTable: Malloy.SQLTable = {
        connection_name: 'connection',
        name: 'flights',
        schema: {
          fields: [
            {
              kind: 'dimension',
              name: 'carrier',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'origin',
              type: {kind: 'string_type'},
            },
            {
              kind: 'dimension',
              name: 'destination',
              type: {kind: 'string_type'},
            },
          ],
        },
      };

      const _result = describeSource({
        model_url: 'file://test.malloy',
        source_name: 'flights',
        compiler_needs: {
          table_schemas: [flightsTable],
          files: [
            {
              url: 'file://test.malloy',
              contents: `
                ##! experimental { composite_sources }

                source: flights is connection.table('flights') -> {
                  group_by: carrier
                  aggregate: flights_by_carrier is count()
                }

                source: flights2 is flights extend {
                  measure: total_flights is flights_by_carrier.sum()
                }

                source: composite is compose(flights, flights2)
                source: composite2 is compose(flights, composite)
              `,
            },
          ],
          connections: [{name: 'connection', dialect: 'presto'}],
        },
      });

      expect(1).toEqual(1);
    });
  });
});
