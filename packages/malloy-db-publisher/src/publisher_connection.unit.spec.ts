/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {PublisherConnection} from './publisher_connection';
import type {ConnectionAttributes} from './client';
import {Configuration, ConnectionsApi, ConnectionsTestApi} from './client';
import type {AxiosResponse} from 'axios';
import type {
  SQLSourceDef,
  MalloyQueryData,
  QueryRecord,
} from '@malloydata/malloy';

// mocks client code for testing - only for unit tests
jest.mock('./client', () => {
  const mockConnectionsApi = {
    getConnection: jest.fn(),
    getTable: jest.fn(),
    getTablesource: jest.fn(),
    getSqlsource: jest.fn(),
    getQuerydata: jest.fn(),
    getTemporarytable: jest.fn(),
    postSqlsource: jest.fn(),
    postQuerydata: jest.fn(),
    postTemporarytable: jest.fn(),
  };

  const mockConnectionsTestApi = {
    testConnectionConfiguration: jest.fn(),
  };

  const mockConfigurationConstructor = jest.fn().mockImplementation(params => ({
    basePath: params?.basePath || 'http://test.com/api/v0',
    baseOptions: params?.baseOptions || {},
  }));

  return {
    Configuration: mockConfigurationConstructor,
    ConnectionsApi: jest.fn().mockImplementation(() => mockConnectionsApi),
    ConnectionsTestApi: jest
      .fn()
      .mockImplementation(() => mockConnectionsTestApi),
  };
});

const [describe] = describeIfDatabaseAvailable(['publisher']);

describe('db:Publisher', () => {
  describe('unit', () => {
    describe('create', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConnectionsTestApi: jest.Mocked<ConnectionsTestApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConnectionsTestApi = new ConnectionsTestApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsTestApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should create a connection successfully', async () => {
        const mockConnectionAttributes: ConnectionAttributes = {
          dialectName: 'bigquery',
          isPool: false,
          canPersist: true,
          canStream: true,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            name: 'test-connection',
            type: 'bigquery',
            attributes: mockConnectionAttributes,
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockTestResponse: AxiosResponse = {
          data: {
            status: 'ok',
            errorMessage: '',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsTestApi.testConnectionConfiguration.mockResolvedValueOnce(
          mockTestResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        expect(connection).toBeInstanceOf(PublisherConnection);
        expect(connection.name).toBe('test-connection');
        expect(connection.projectName).toBe('test-project');
        expect(connection.dialectName).toBe('bigquery');
        expect(connection.isPool()).toBe(false);
        expect(connection.canPersist()).toBe(true);
        expect(connection.canStream()).toBe(true);
        expect(mockConnectionsApi.getConnection).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should throw error for invalid connection URI format', async () => {
        await expect(
          PublisherConnection.create('test-connection', {
            connectionUri: 'http://test.com/invalid/path',
            accessToken: 'test-token',
          })
        ).rejects.toThrow('Invalid connection URI');
      });

      it('should throw error for connection name mismatch', async () => {
        await expect(
          PublisherConnection.create('different-name', {
            connectionUri:
              'http://test.com/api/v0/projects/test-project/connections/test-connection',
            accessToken: 'test-token',
          })
        ).rejects.toThrow('Connection name mismatch');
      });

      it('should handle no access token', async () => {
        const mockConnectionAttributes: ConnectionAttributes = {
          dialectName: 'bigquery',
          isPool: false,
          canPersist: true,
          canStream: true,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            name: 'test-connection',
            type: 'bigquery',
            attributes: mockConnectionAttributes,
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockTestResponse: AxiosResponse = {
          data: {
            status: 'ok',
            errorMessage: '',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsTestApi.testConnectionConfiguration.mockResolvedValueOnce(
          mockTestResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
        });

        expect(connection).toBeInstanceOf(PublisherConnection);
        expect(mockConnectionsApi.getConnection).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {
            headers: {},
          }
        );
      });

      it('should configure timeout correctly', async () => {
        const mockConnectionAttributes: ConnectionAttributes = {
          dialectName: 'bigquery',
          isPool: false,
          canPersist: true,
          canStream: true,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            name: 'test-connection',
            type: 'bigquery',
            attributes: mockConnectionAttributes,
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockTestResponse: AxiosResponse = {
          data: {
            status: 'ok',
            errorMessage: '',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsTestApi.testConnectionConfiguration.mockResolvedValueOnce(
          mockTestResponse
        );

        await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        // Verify Configuration was called with correct timeout
        const {Configuration} = jest.requireMock('./client');
        expect(Configuration).toHaveBeenCalledWith(
          expect.objectContaining({
            basePath: 'http://test.com/api/v0',
            baseOptions: expect.objectContaining({
              timeout: 600000, // 10 minutes in milliseconds
            }),
          })
        );
      });
    });

    describe('fetchTableSchema', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should fetch table schema successfully', async () => {
        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockTableResponse: AxiosResponse = {
          data: {
            resource: 'test_path',
            columns: [
              {name: 'id', type: 'number'},
              {name: 'name', type: 'string'},
            ],
            source: JSON.stringify({
              type: 'table',
              name: 'test_key',
              tablePath: 'test_path',
              connection: 'test-connection',
              dialect: 'bigquery',
              fields: [
                {name: 'id', type: 'number'},
                {name: 'name', type: 'string'},
              ],
            }),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTable.mockResolvedValueOnce(mockTableResponse);

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const schema = await connection.fetchTableSchema(
          'test_key',
          'test_path'
        );

        expect(schema).toEqual({
          type: 'table',
          name: 'test_key',
          tablePath: 'test_path',
          connection: 'test-connection',
          dialect: 'bigquery',
          fields: [
            {name: 'id', type: 'number'},
            {name: 'name', type: 'string'},
          ],
        });
        expect(mockConnectionsApi.getTable).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'test_path',
          'test_path',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
        await setupAndTestApiError(mockConnectionsApi, 'getTable', connection =>
          connection.fetchTableSchema('test_key', 'test_path')
        );
      });

      it('should handle invalid JSON response', async () => {
        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockInvalidResponse: AxiosResponse = {
          data: {
            resource: 'invalid json',
            columns: null,
            source: 'invalid json',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTable.mockResolvedValueOnce(mockInvalidResponse);

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.fetchTableSchema('test_key', 'test_path')
        ).rejects.toThrow(SyntaxError);
      });
    });

    describe('fetchSelectSchema', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should fetch SQL schema successfully', async () => {
        const mockSqlSchema: SQLSourceDef = {
          type: 'sql_select',
          name: 'test_query',
          selectStr: 'SELECT * FROM test_table',
          connection: 'test-connection',
          dialect: 'bigquery',
          fields: [
            {name: 'id', type: 'number'},
            {name: 'name', type: 'string'},
          ],
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockSqlResponse: AxiosResponse = {
          data: {
            source: JSON.stringify(mockSqlSchema),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.postSqlsource.mockResolvedValueOnce(mockSqlResponse);

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const schema = await connection.fetchSelectSchema({
          selectStr: 'SELECT * FROM test_table',
          connection: 'test-connection',
        });

        expect(schema).toEqual(mockSqlSchema);
        expect(mockConnectionsApi.postSqlsource).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {
            sqlStatement: 'SELECT * FROM test_table',
          },
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
        await setupAndTestApiError(
          mockConnectionsApi,
          'postSqlsource',
          connection =>
            connection.fetchSelectSchema({
              selectStr: 'SELECT * FROM test_table',
              connection: 'test-connection',
            })
        );
      });

      it('should handle invalid JSON response', async () => {
        await setupAndTestInvalidJsonResponse(
          mockConnectionsApi,
          'postSqlsource',
          connection =>
            connection.fetchSelectSchema({
              selectStr: 'SELECT * FROM test_table',
              connection: 'test-connection',
            })
        );
      });
    });

    describe('runSQL', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should run SQL query successfully', async () => {
        const mockQueryData: MalloyQueryData = {
          rows: [
            {id: 1, name: 'test1'},
            {id: 2, name: 'test2'},
          ],
          totalRows: 2,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.postQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const result = await connection.runSQL('SELECT * FROM test_table');

        expect(result).toEqual(mockQueryData);
        expect(mockConnectionsApi.postQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {sqlStatement: 'SELECT * FROM test_table'},
          JSON.stringify({}),
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should run SQL query with options', async () => {
        const mockQueryData: MalloyQueryData = {
          rows: [
            {id: 1, name: 'test1'},
            {id: 2, name: 'test2'},
          ],
          totalRows: 2,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.postQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const options = {
          rowLimit: 100,
          timeoutMs: 5000,
        };

        const result = await connection.runSQL(
          'SELECT * FROM test_table',
          options
        );

        expect(result).toEqual(mockQueryData);
        expect(mockConnectionsApi.postQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {sqlStatement: 'SELECT * FROM test_table'},
          JSON.stringify(options),
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
        await setupAndTestApiError(
          mockConnectionsApi,
          'postQuerydata',
          connection => connection.runSQL('SELECT * FROM test_table')
        );
      });

      it('should handle invalid JSON response', async () => {
        await setupAndTestInvalidJsonResponse(
          mockConnectionsApi,
          'postQuerydata',
          connection => connection.runSQL('SELECT * FROM test_table'),
          {data: 'invalid json'}
        );
      });
    });

    describe('runSQLStream', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should stream SQL query results successfully', async () => {
        const mockQueryData: MalloyQueryData = {
          rows: [
            {id: 1, name: 'test1'},
            {id: 2, name: 'test2'},
          ],
          totalRows: 2,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.postQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const stream = connection.runSQLStream('SELECT * FROM test_table');
        const results: QueryRecord[] = [];

        for await (const row of stream) {
          results.push(row);
        }

        expect(results).toEqual(mockQueryData.rows);
        expect(mockConnectionsApi.postQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {sqlStatement: 'SELECT * FROM test_table'},
          '{}',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should stream SQL query results with options', async () => {
        const mockQueryData: MalloyQueryData = {
          rows: [
            {id: 1, name: 'test1'},
            {id: 2, name: 'test2'},
          ],
          totalRows: 2,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.postQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const options = {
          rowLimit: 100,
          timeoutMs: 5000,
        };

        const stream = connection.runSQLStream(
          'SELECT * FROM test_table',
          options
        );
        const results: QueryRecord[] = [];

        for await (const row of stream) {
          results.push(row);
        }

        expect(results).toEqual(mockQueryData.rows);
        expect(mockConnectionsApi.postQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {sqlStatement: 'SELECT * FROM test_table'},
          JSON.stringify(options),
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
        await setupAndTestApiError(
          mockConnectionsApi,
          'postQuerydata',
          async connection => {
            const stream = connection.runSQLStream('SELECT * FROM test_table');
            const results: QueryRecord[] = [];
            for await (const row of stream) {
              results.push(row);
            }
          }
        );
      });

      it('should handle invalid JSON response', async () => {
        await setupAndTestInvalidJsonResponse(
          mockConnectionsApi,
          'postQuerydata',
          async connection => {
            const stream = connection.runSQLStream('SELECT * FROM test_table');
            const results: QueryRecord[] = [];
            for await (const row of stream) {
              results.push(row);
            }
          },
          {data: 'invalid json'}
        );
      });
    });

    describe('manifestTemporaryTable', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should create temporary table successfully', async () => {
        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockTableResponse: AxiosResponse = {
          data: {
            table: 'temp_table_123',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.postTemporarytable.mockResolvedValueOnce(
          mockTableResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const tableName = await connection.manifestTemporaryTable(
          'SELECT * FROM test_table'
        );

        expect(tableName).toBe('temp_table_123');
        expect(mockConnectionsApi.postTemporarytable).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {sqlStatement: 'SELECT * FROM test_table'},
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
        await setupAndTestApiError(
          mockConnectionsApi,
          'postTemporarytable',
          connection =>
            connection.manifestTemporaryTable('SELECT * FROM test_table')
        );
      });
    });

    describe('test', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConnectionsTestApi: jest.Mocked<ConnectionsTestApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConnectionsTestApi = new ConnectionsTestApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsTestApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should test connection successfully', async () => {
        const mockConnectionResponse: AxiosResponse = {
          data: {
            name: 'test-connection',
            type: 'bigquery',
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        const mockTestResponse: AxiosResponse = {
          data: {
            status: 'ok',
            errorMessage: '',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsTestApi.testConnectionConfiguration.mockResolvedValueOnce(
          mockTestResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(connection.test()).resolves.not.toThrow();
        expect(
          mockConnectionsTestApi.testConnectionConfiguration
        ).toHaveBeenCalledWith(
          {
            name: 'test-connection',
            type: 'bigquery',
            attributes: {
              dialectName: 'bigquery',
              isPool: false,
              canPersist: true,
              canStream: true,
            },
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });
    });

    describe('estimateQueryCost', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      it('should return empty object for query cost estimation', async () => {
        const mockConnectionAttributes: ConnectionAttributes = {
          dialectName: 'bigquery',
          isPool: false,
          canPersist: true,
          canStream: true,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            name: 'test-connection',
            type: 'bigquery',
            attributes: mockConnectionAttributes,
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const cost = await connection.estimateQueryCost(
          'SELECT * FROM test_table'
        );

        expect(cost).toEqual({});
      });
    });

    describe('close', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let _mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        _mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      it('should close connection successfully', async () => {
        const mockConnectionAttributes: ConnectionAttributes = {
          dialectName: 'bigquery',
          isPool: false,
          canPersist: true,
          canStream: true,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            name: 'test-connection',
            type: 'bigquery',
            attributes: mockConnectionAttributes,
            bigqueryConnection: {
              defaultProjectId: 'test-project',
              billingProjectId: 'test-project',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as AxiosResponse['config'],
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        // close() should not throw and should return void
        await expect(connection.close()).resolves.toBeUndefined();
      });
    });
  });
});

// helper function for handling API errors test cases
async function testErrorHandling(
  connection: PublisherConnection,
  operation: () => Promise<unknown>,
  errorMessage?: string
) {
  if (errorMessage) {
    await expect(operation()).rejects.toThrow(errorMessage);
  } else {
    await expect(operation()).rejects.toThrow();
  }
}

// handles API errors test cases
async function setupAndTestApiError(
  mockConnectionsApi: jest.Mocked<ConnectionsApi>,
  apiMethod: keyof jest.Mocked<ConnectionsApi>,
  operation: (connection: PublisherConnection) => Promise<unknown>,
  errorMessage = 'API Error'
) {
  const mockConnectionResponse: AxiosResponse = {
    data: {
      attributes: {
        dialectName: 'bigquery',
        isPool: false,
        canPersist: true,
        canStream: true,
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
  };

  mockConnectionsApi.getConnection.mockResolvedValueOnce(
    mockConnectionResponse
  );
  mockConnectionsApi[apiMethod].mockRejectedValueOnce(new Error(errorMessage));

  const connection = await PublisherConnection.create('test-connection', {
    connectionUri:
      'http://test.com/api/v0/projects/test-project/connections/test-connection',
    accessToken: 'test-token',
  });

  await testErrorHandling(
    connection,
    () => operation(connection),
    errorMessage
  );
}

// handles invalid JSON response test cases
async function setupAndTestInvalidJsonResponse(
  mockConnectionsApi: jest.Mocked<ConnectionsApi>,
  apiMethod: keyof jest.Mocked<ConnectionsApi>,
  operation: (connection: PublisherConnection) => Promise<unknown>,
  responseData: Record<string, unknown> = {source: 'invalid json'}
) {
  const mockConnectionResponse: AxiosResponse = {
    data: {
      attributes: {
        dialectName: 'bigquery',
        isPool: false,
        canPersist: true,
        canStream: true,
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
  };

  const mockInvalidResponse: AxiosResponse = {
    data: responseData,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
  };

  mockConnectionsApi.getConnection.mockResolvedValueOnce(
    mockConnectionResponse
  );
  mockConnectionsApi[apiMethod].mockResolvedValueOnce(mockInvalidResponse);

  const connection = await PublisherConnection.create('test-connection', {
    connectionUri:
      'http://test.com/api/v0/projects/test-project/connections/test-connection',
    accessToken: 'test-token',
  });

  await testErrorHandling(connection, () => operation(connection));
}
