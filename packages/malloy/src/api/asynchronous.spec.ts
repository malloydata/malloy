/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {compileModel, compileQuery, runQuery} from './asynchronous';
import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Connection, InfoConnection, LookupConnection} from './connection';
import type {InfoConnection as LegacyInfoConnection} from '../connection';
import {wrapLegacyInfoConnection} from './util';
import type {TableSourceDef} from '../model';
import type {URLReader} from '../runtime_types';

describe('api', () => {
  describe('compile model', () => {
    test('compile model with table dependency', async () => {
      const connection: InfoConnection = {
        dialectName: 'duckdb',
        fetchSchemaForTable: async (_name: string) => {
          return {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
              },
            ],
          };
        },
        fetchSchemaForSQLQuery: async (_sql: string) => {
          throw new Error('not implemented');
        },
      };
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return "source: flights is connection.table('flights')";
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const fetchers = {
        urls,
        connections,
      };
      const result = await compileModel(
        {
          model_url: 'file://test.malloy',
        },
        fetchers
      );
      const expected: Malloy.CompileModelResponse = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
      expect(result).toMatchObject(expected);
    });

    // A DuckDB file-path table (canonical form is single-quoted) compiles
    // through the stateless API even though its dialect isn't known on the
    // first round and the path can't be canonicalized until it is.
    test('file-path table is deferred until its dialect resolves', async () => {
      const legacy: LegacyInfoConnection = {
        get name() {
          return 'duckdb';
        },
        get dialectName() {
          return 'duckdb';
        },
        getDigest: () => 'duckdb-digest',
        fetchSchemaForSQLStruct: async () => {
          throw new Error('not implemented');
        },
        fetchSchemaForTables: async (tables: Record<string, string>) => {
          const schemas: Record<string, TableSourceDef> = {};
          for (const [key, tablePath] of Object.entries(tables)) {
            schemas[key] = {
              type: 'table',
              name: tablePath,
              dialect: 'duckdb',
              connection: 'duckdb',
              tablePath,
              fields: [{name: 'category', type: 'string'}],
            };
          }
          return {schemas, errors: {}};
        },
      };
      const connection = wrapLegacyInfoConnection(legacy);
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return "source: products is duckdb.table('static/data/products.parquet')";
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const result = await compileModel(
        {
          model_url: 'file://test.malloy',
        },
        {urls, connections}
      );
      expect(result.logs ?? []).toEqual([]);
      expect(result.model).toBeDefined();
      expect(result.model?.entries).toMatchObject([
        {kind: 'source', name: 'products'},
      ]);
    });
  });
  describe('compile query', () => {
    test('compile query with table dependency', async () => {
      const connection: InfoConnection = {
        dialectName: 'duckdb',
        fetchSchemaForTable: async (_name: string) => {
          return {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
              },
            ],
          };
        },
        fetchSchemaForSQLQuery: async (_sql: string) => {
          throw new Error('not implemented');
        },
      };
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return "source: flights is connection.table('flights')";
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const fetchers = {
        urls,
        connections,
      };
      const result = await compileQuery(
        {
          model_url: 'file://test.malloy',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'flights'},
              view: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {kind: 'field_reference', name: 'carrier'},
                    },
                  },
                ],
              },
            },
          },
        },
        fetchers
      );
      const expected: Malloy.CompileQueryResponse = {
        result: {
          connection_name: 'connection',
          sql: `SELECT \n\
   base."carrier" as "carrier"
FROM flights as base
GROUP BY 1
ORDER BY 1 asc NULLS LAST
`,
          schema: {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
              },
            ],
          },
        },
      };
      expect(result).toMatchObject(expected);
    });
  });
  describe('run query', () => {
    test('run query with table dependency', async () => {
      const data: Malloy.Data = {
        kind: 'array_cell',
        array_value: [
          {
            kind: 'record_cell',
            record_value: [{kind: 'string_cell', string_value: 'WN'}],
          },
          {
            kind: 'record_cell',
            record_value: [{kind: 'string_cell', string_value: 'AA'}],
          },
        ],
      };
      const connection: Connection = {
        dialectName: 'duckdb',
        fetchSchemaForTable: async (_name: string) => {
          return {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
              },
            ],
          };
        },
        fetchSchemaForSQLQuery: async (_sql: string) => {
          throw new Error('not implemented');
        },
        runSQL: async (_sql: string) => {
          return data;
        },
      };
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return "source: flights is connection.table('flights')";
        },
      };
      const connections: LookupConnection<Connection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const fetchers = {
        urls,
        connections,
      };
      const result = await runQuery(
        {
          model_url: 'file://test.malloy',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'flights'},
              view: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {kind: 'field_reference', name: 'carrier'},
                    },
                  },
                ],
              },
            },
          },
        },
        fetchers
      );
      const expected: Malloy.CompileQueryResponse = {
        result: {
          connection_name: 'connection',
          sql: `SELECT \n\
   base."carrier" as "carrier"
FROM flights as base
GROUP BY 1
ORDER BY 1 asc NULLS LAST
`,
          schema: {
            fields: [
              {
                kind: 'dimension',
                name: 'carrier',
                type: {kind: 'string_type'},
              },
            ],
          },
          data,
        },
      };
      expect(result).toMatchObject(expected);
      // Check the timing envelope, not the round structure.
      expect(result.timing_info).toMatchObject({
        name: 'run_query',
        duration_ms: expect.any(Number),
      });
      expect(result.timing_info?.detailed_timing?.length).toBeGreaterThan(0);
    });

    test('bigint field type propagates through stable API schema (table source)', async () => {
      const connection: InfoConnection = {
        dialectName: 'duckdb',
        fetchSchemaForTable: async (_name: string) => {
          return {
            fields: [
              {
                kind: 'dimension',
                name: 'bigint_val',
                type: {kind: 'number_type', subtype: 'bigint'},
              },
            ],
          };
        },
        fetchSchemaForSQLQuery: async (_sql: string) => {
          throw new Error('not implemented');
        },
      };
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return "source: test_src is connection.table('test_table')";
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const fetchers = {
        urls,
        connections,
      };
      const result = await compileQuery(
        {
          model_url: 'file://test.malloy',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'test_src'},
              view: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {kind: 'field_reference', name: 'bigint_val'},
                    },
                  },
                ],
              },
            },
          },
        },
        fetchers
      );

      expect(result.result).toBeDefined();
      expect(result.result?.schema.fields[0]).toMatchObject({
        kind: 'dimension',
        name: 'bigint_val',
        type: {kind: 'number_type', subtype: 'bigint'},
      });
    });

    test('bigint field type propagates through stable API schema (SQL source)', async () => {
      // This test simulates what Storybook does with duckdb.sql("SELECT ... BIGINT ...")
      const connection: InfoConnection = {
        dialectName: 'duckdb',
        fetchSchemaForTable: async (_name: string) => {
          throw new Error('not implemented');
        },
        fetchSchemaForSQLQuery: async (_sql: string) => {
          // Return schema as if it came from a SQL query with BIGINT column
          return {
            fields: [
              {
                kind: 'dimension',
                name: 'bigint_val',
                type: {kind: 'number_type', subtype: 'bigint'},
              },
            ],
          };
        },
      };
      const urls: URLReader = {
        readURL: async (_url: URL) => {
          // Use duckdb.sql() source like Storybook does
          return 'source: test_src is duckdb.sql("SELECT 9007199254740993::BIGINT as bigint_val")';
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return connection;
        },
      };
      const fetchers = {
        urls,
        connections,
      };
      const result = await compileQuery(
        {
          model_url: 'file://test.malloy',
          query: {
            definition: {
              kind: 'arrow',
              source: {kind: 'source_reference', name: 'test_src'},
              view: {
                kind: 'segment',
                operations: [
                  {
                    kind: 'group_by',
                    field: {
                      expression: {kind: 'field_reference', name: 'bigint_val'},
                    },
                  },
                ],
              },
            },
          },
        },
        fetchers
      );

      expect(result.result).toBeDefined();
      expect(result.result?.schema.fields[0]).toMatchObject({
        kind: 'dimension',
        name: 'bigint_val',
        type: {kind: 'number_type', subtype: 'bigint'},
      });
    });
  });
});
