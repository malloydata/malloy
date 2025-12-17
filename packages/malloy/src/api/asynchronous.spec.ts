/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {compileModel, compileQuery, runQuery} from './asynchronous';
import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Connection, InfoConnection, LookupConnection} from './connection';
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
      expect(result).toMatchObject({
        timing_info: {
          name: 'run_query',
          duration_ms: expect.any(Number),
          detailed_timing: [
            {name: 'compile_model'},
            {name: 'read_url'},
            {name: 'compile_model', detailed_timing: [{name: 'parse_malloy'}]},
            {name: 'lookup_connection'},
            {name: 'lookup_connection'},
            {name: 'fetch_table_schemas'},
            {
              name: 'compile_model',
              detailed_timing: [
                {
                  name: 'generate_ast',
                  detailed_timing: [{name: 'parse_compiler_flags'}],
                },
                {name: 'compile_malloy'},
              ],
            },
            {name: 'parse_compiler_flags'},
            {name: 'parse_malloy'},
            {
              name: 'generate_ast',
              detailed_timing: [{name: 'parse_compiler_flags'}],
            },
            {name: 'compile_malloy'},
            {name: 'generate_sql'},
            {name: 'lookup_connection'},
            {name: 'run_sql'},
          ],
        },
      });
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

      // Check that the schema has the correct bigint subtype
      console.log('=== STABLE API TABLE SOURCE RESULT ===');
      console.log(JSON.stringify(result.result?.schema, null, 2));

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
          return `source: test_src is duckdb.sql("SELECT 9007199254740993::BIGINT as bigint_val")`;
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

      // Check that the schema has the correct bigint subtype
      console.log('=== STABLE API SQL SOURCE RESULT ===');
      console.log(JSON.stringify(result.result?.schema, null, 2));

      expect(result.result).toBeDefined();
      expect(result.result?.schema.fields[0]).toMatchObject({
        kind: 'dimension',
        name: 'bigint_val',
        type: {kind: 'number_type', subtype: 'bigint'},
      });
    });

    test('bigint field type propagates through wrapLegacyInfoConnection', async () => {
      // This test uses wrapLegacyInfoConnection to convert a legacy connection
      // that returns internal format with numberType: 'bigint'
      const legacyConnection = {
        name: 'duckdb',
        dialectName: 'duckdb',
        fetchSchemaForTables: async (
          missing: Record<string, string>,
          _options: Record<string, unknown>
        ) => {
          const schemas: Record<string, {type: 'table'; fields: unknown[]}> = {};
          for (const key in missing) {
            schemas[key] = {
              type: 'table',
              fields: [
                {
                  type: 'number',
                  numberType: 'bigint', // Internal format
                  name: 'bigint_val',
                },
              ],
            };
          }
          return {schemas, errors: {}};
        },
        fetchSchemaForSQLStruct: async (
          _sqlRef: {connection: string; selectStr: string},
          _options: Record<string, unknown>
        ) => {
          return {
            structDef: {
              type: 'sql_select',
              fields: [
                {
                  type: 'number',
                  numberType: 'bigint', // Internal format
                  name: 'bigint_val',
                },
              ],
            },
          };
        },
      };

      // Import wrapLegacyInfoConnection
      const {wrapLegacyInfoConnection} = await import('./util');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrappedConnection = wrapLegacyInfoConnection(legacyConnection as any);

      // Test fetchSchemaForTable
      const tableSchema = await wrappedConnection.fetchSchemaForTable(
        'test_table'
      );
      console.log('=== WRAPPED TABLE SCHEMA ===');
      console.log(JSON.stringify(tableSchema, null, 2));

      expect(tableSchema.fields[0]).toMatchObject({
        kind: 'dimension',
        name: 'bigint_val',
        type: {kind: 'number_type', subtype: 'bigint'},
      });

      // Test fetchSchemaForSQLQuery
      const sqlSchema = await wrappedConnection.fetchSchemaForSQLQuery(
        'SELECT 1::BIGINT as bigint_val'
      );
      console.log('=== WRAPPED SQL SCHEMA ===');
      console.log(JSON.stringify(sqlSchema, null, 2));

      expect(sqlSchema.fields[0]).toMatchObject({
        kind: 'dimension',
        name: 'bigint_val',
        type: {kind: 'number_type', subtype: 'bigint'},
      });
    });

    test('bigint through full stable API with wrapped legacy connection', async () => {
      // This test uses wrapLegacyInfoConnection in the full stable API flow
      // to simulate what Storybook does
      const {wrapLegacyInfoConnection} = await import('./util');

      const legacyConnection = {
        name: 'duckdb',
        dialectName: 'duckdb',
        fetchSchemaForTables: async (
          missing: Record<string, string>,
          _options: Record<string, unknown>
        ) => {
          const schemas: Record<string, {type: 'table'; fields: unknown[]}> = {};
          for (const key in missing) {
            schemas[key] = {
              type: 'table',
              fields: [
                {
                  type: 'number',
                  numberType: 'bigint', // Internal format
                  name: 'bigint_val',
                },
              ],
            };
          }
          return {schemas, errors: {}};
        },
        fetchSchemaForSQLStruct: async (
          _sqlRef: {connection: string; selectStr: string},
          _options: Record<string, unknown>
        ) => {
          return {
            structDef: {
              type: 'sql_select',
              fields: [
                {
                  type: 'number',
                  numberType: 'bigint', // Internal format
                  name: 'bigint_val',
                },
              ],
            },
          };
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrappedConnection = wrapLegacyInfoConnection(legacyConnection as any);

      const urls: URLReader = {
        readURL: async (_url: URL) => {
          return `source: test_src is duckdb.sql("SELECT 9007199254740993::BIGINT as bigint_val")`;
        },
      };
      const connections: LookupConnection<InfoConnection> = {
        lookupConnection: async (_name: string) => {
          return wrappedConnection;
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

      console.log('=== FULL STABLE API WITH WRAPPED LEGACY CONNECTION ===');
      console.log(JSON.stringify(result.result?.schema, null, 2));

      expect(result.result).toBeDefined();
      expect(result.result?.schema.fields[0]).toMatchObject({
        kind: 'dimension',
        name: 'bigint_val',
        type: {kind: 'number_type', subtype: 'bigint'},
      });
    });
  });
});
