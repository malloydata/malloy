import * as malloy from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {PublisherConnection} from './publisher_connection';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as fs from 'fs';
import {Configuration, ConnectionAttributes, ConnectionsApi} from './client';
import {jest} from '@jest/globals';
import {AxiosResponse} from 'axios';
import {
  TableSourceDef,
  SQLSourceDef,
  MalloyQueryData,
  QueryDataRow,
} from '@malloydata/malloy';

// mocks client code for testing
jest.mock('./client', () => {
  const mockConnectionsApi = {
    getConnection: jest.fn(),
    getTest: jest.fn(),
    getTablesource: jest.fn(),
    getSqlsource: jest.fn(),
    getQuerydata: jest.fn(),
    getTemporarytable: jest.fn(),
  };

  const mockConfiguration = {
    basePath: 'http://test.com/api/v0',
  };

  return {
    Configuration: jest.fn().mockImplementation(() => mockConfiguration),
    ConnectionsApi: jest.fn().mockImplementation(() => mockConnectionsApi),
  };
});

const [describe] = describeIfDatabaseAvailable(['publisher']);

describe('db:Publisher', () => {
  describe('unit', () => {
    describe('create', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
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
            attributes: mockConnectionAttributes,
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        const mockTestResponse: AxiosResponse = {
          data: undefined,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTest.mockResolvedValueOnce(mockTestResponse);

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        expect(connection).toBeInstanceOf(PublisherConnection);
        expect(connection.name).toBe('test-connection');
        expect(connection.projectName).toBe('test-project');
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

      it('should handle missing access token', async () => {
        const mockConnectionAttributes: ConnectionAttributes = {
          dialectName: 'bigquery',
          isPool: false,
          canPersist: true,
          canStream: true,
        };

        const mockConnectionResponse: AxiosResponse = {
          data: {
            attributes: mockConnectionAttributes,
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        const mockTestResponse: AxiosResponse = {
          data: undefined,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTest.mockResolvedValueOnce(mockTestResponse);

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
    });

    describe('fetchTableSchema', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should fetch table schema successfully', async () => {
        const mockTableSchema: TableSourceDef = {
          type: 'table',
          name: 'test_table',
          tablePath: 'test_path',
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
          config: {} as any,
        };

        const mockTableResponse: AxiosResponse = {
          data: {
            source: JSON.stringify(mockTableSchema),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTablesource.mockResolvedValueOnce(
          mockTableResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const schema = await connection.fetchTableSchema(
          'test_key',
          'test_path'
        );

        expect(schema).toEqual(mockTableSchema);
        expect(mockConnectionsApi.getTablesource).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'test_key',
          'test_path',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
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
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTablesource.mockRejectedValueOnce(
          new Error('API Error')
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.fetchTableSchema('test_key', 'test_path')
        ).rejects.toThrow('API Error');
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
          config: {} as any,
        };

        const mockTableResponse: AxiosResponse = {
          data: {
            source: 'invalid json',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTablesource.mockResolvedValueOnce(
          mockTableResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.fetchTableSchema('test_key', 'test_path')
        ).rejects.toThrow();
      });
    });

    describe('fetchSelectSchema', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
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
          config: {} as any,
        };

        const mockSqlResponse: AxiosResponse = {
          data: {
            source: JSON.stringify(mockSqlSchema),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getSqlsource.mockResolvedValueOnce(mockSqlResponse);

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
        expect(mockConnectionsApi.getSqlsource).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'SELECT * FROM test_table',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
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
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getSqlsource.mockRejectedValueOnce(
          new Error('API Error')
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.fetchSelectSchema({
            selectStr: 'SELECT * FROM test_table',
            connection: 'test-connection',
          })
        ).rejects.toThrow('API Error');
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
          config: {} as any,
        };

        const mockSqlResponse: AxiosResponse = {
          data: {
            source: 'invalid json',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getSqlsource.mockResolvedValueOnce(mockSqlResponse);

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.fetchSelectSchema({
            selectStr: 'SELECT * FROM test_table',
            connection: 'test-connection',
          })
        ).rejects.toThrow();
      });
    });

    describe('runSQL', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
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
          config: {} as any,
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const result = await connection.runSQL('SELECT * FROM test_table');

        expect(result).toEqual(mockQueryData);
        expect(mockConnectionsApi.getQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'SELECT * FROM test_table',
          '{}',
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
          config: {} as any,
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockResolvedValueOnce(
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
        expect(mockConnectionsApi.getQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'SELECT * FROM test_table',
          JSON.stringify(options),
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
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
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockRejectedValueOnce(
          new Error('API Error')
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.runSQL('SELECT * FROM test_table')
        ).rejects.toThrow('API Error');
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
          config: {} as any,
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: 'invalid json',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.runSQL('SELECT * FROM test_table')
        ).rejects.toThrow();
      });
    });

    describe('runSQLStream', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
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
          config: {} as any,
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const stream = connection.runSQLStream('SELECT * FROM test_table');
        const results: QueryDataRow[] = [];

        for await (const row of stream) {
          results.push(row);
        }

        expect(results).toEqual(mockQueryData.rows);
        expect(mockConnectionsApi.getQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'SELECT * FROM test_table',
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
          config: {} as any,
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: JSON.stringify(mockQueryData),
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockResolvedValueOnce(
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
        const results: QueryDataRow[] = [];

        for await (const row of stream) {
          results.push(row);
        }

        expect(results).toEqual(mockQueryData.rows);
        expect(mockConnectionsApi.getQuerydata).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'SELECT * FROM test_table',
          JSON.stringify(options),
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
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
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockRejectedValueOnce(
          new Error('API Error')
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const stream = connection.runSQLStream('SELECT * FROM test_table');
        const results: QueryDataRow[] = [];

        await expect(async () => {
          for await (const row of stream) {
            results.push(row);
          }
        }).rejects.toThrow('API Error');
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
          config: {} as any,
        };

        const mockQueryResponse: AxiosResponse = {
          data: {
            data: 'invalid json',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getQuerydata.mockResolvedValueOnce(
          mockQueryResponse
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        const stream = connection.runSQLStream('SELECT * FROM test_table');
        const results: QueryDataRow[] = [];

        await expect(async () => {
          for await (const row of stream) {
            results.push(row);
          }
        }).rejects.toThrow();
      });
    });

    describe('manifestTemporaryTable', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
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
          config: {} as any,
        };

        const mockTableResponse: AxiosResponse = {
          data: {
            table: 'temp_table_123',
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTemporarytable.mockResolvedValueOnce(
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
        expect(mockConnectionsApi.getTemporarytable).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          'SELECT * FROM test_table',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });

      it('should handle API errors', async () => {
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
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTemporarytable.mockRejectedValueOnce(
          new Error('API Error')
        );

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(
          connection.manifestTemporaryTable('SELECT * FROM test_table')
        ).rejects.toThrow('API Error');
      });
    });

    describe('test', () => {
      let mockConnectionsApi: jest.Mocked<ConnectionsApi>;
      let mockConfiguration: jest.Mocked<Configuration>;

      beforeEach(() => {
        // Get fresh instances of the mocks
        mockConnectionsApi = new ConnectionsApi(
          new Configuration()
        ) as jest.Mocked<ConnectionsApi>;
        mockConfiguration = new Configuration() as jest.Mocked<Configuration>;
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should test connection successfully', async () => {
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
          config: {} as any,
        };

        const mockTestResponse: AxiosResponse = {
          data: undefined,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        mockConnectionsApi.getConnection.mockResolvedValueOnce(
          mockConnectionResponse
        );
        mockConnectionsApi.getTest.mockResolvedValueOnce(mockTestResponse);

        const connection = await PublisherConnection.create('test-connection', {
          connectionUri:
            'http://test.com/api/v0/projects/test-project/connections/test-connection',
          accessToken: 'test-token',
        });

        await expect(connection.test()).resolves.not.toThrow();
        expect(mockConnectionsApi.getTest).toHaveBeenCalledWith(
          'test-project',
          'test-connection',
          {
            headers: {
              Authorization: 'Bearer test-token',
            },
          }
        );
      });
    });
  });

  describe.skip('integration', () => {
    let conn: PublisherConnection;
    let runtime: malloy.Runtime;

    beforeEach(async () => {
      conn = await PublisherConnection.create(
        'bigquery',
        //{
        //connectionUri: 'http://localhost:4000/api/v0/projects/malloy-samples/connections/bigquery',
        //}
        {
          connectionUri:
            'http://demo.data.pathways.localhost:8000/api/v0/projects/malloy-samples/connections/bigquery',
          accessToken: 'xyz',
        }
      );
      const files = {
        readURL: async (url: URL) => {
          const filePath = fileURLToPath(url);
          return await util.promisify(fs.readFile)(filePath, 'utf8');
        },
      };
      runtime = new malloy.Runtime({
        urlReader: files,
        connection: conn,
      });
    });

    afterEach(async () => {
      await conn.close();
    });

    it('tests the connection', async () => {
      await conn.test();
    });

    it('correctly identifies the dialect', () => {
      expect(conn.dialectName).toBe('standardsql');
    });

    it('correctly identifies the connection as a pooled connection', () => {
      expect(conn.isPool()).toBe(false);
    });

    it('correctly identifies the connection as a streaming connection', () => {
      expect(conn.canStream()).toBe(true);
    });

    it('correctly identifies the connection as a persistSQLResults connection', () => {
      expect(conn.canPersist()).toBe(true);
    });

    it('fetches the table schema', async () => {
      const schema = await conn.fetchTableSchema(
        'bigquery',
        'bigquery-public-data.hacker_news.full'
      );
      expect(schema.type).toBe('table');
      expect(schema.dialect).toBe('standardsql');
      expect(schema.tablePath).toBe('bigquery-public-data.hacker_news.full');
      expect(schema.fields.length).toBe(14);
      expect(schema.fields[0].name).toBe('title');
      expect(schema.fields[0].type).toBe('string');
    });

    it('fetches the sql source schema', async () => {
      const schema = await conn.fetchSelectSchema({
        connection: 'bigquery',
        selectStr: 'SELECT * FROM bigquery-public-data.hacker_news.full',
      });
      expect(schema.type).toBe('sql_select');
      expect(schema.dialect).toBe('standardsql');
      expect(schema.fields.length).toBe(14);
      expect(schema.fields[0].name).toBe('title');
      expect(schema.fields[0].type).toBe('string');
    });

    it('runs a SQL query', async () => {
      const res = await conn.runSQL('SELECT 1 as T');
      expect(res.rows[0]['T']).toBe(1);
    });

    it('runs a Malloy query', async () => {
      const sql = await runtime
        .loadModel(
          "source: stories is bigquery.table('bigquery-public-data.hacker_news.full')"
        )
        .loadQuery(
          'run:  stories -> { aggregate: cnt is count() group_by: `by` order_by: cnt desc limit: 10 }'
        )
        .getSQL();
      const res = await conn.runSQL(sql);
      expect(res.totalRows).toBe(10);
      let total = 0;
      for (const row of res.rows) {
        total += +(row['cnt'] ?? 0);
      }
      expect(total).toBe(1836679);
    });

    it('runs a Malloy query on an sql source', async () => {
      const sql = await runtime
        .loadModel(
          "source: stories is bigquery.sql('SELECT * FROM bigquery-public-data.hacker_news.full')"
        )
        .loadQuery(
          'run:  stories -> { aggregate: cnt is count() group_by: `by` order_by: cnt desc limit: 20 }'
        )
        .getSQL();
      const res = await conn.runSQL(sql);
      expect(res.totalRows).toBe(20);
      expect(res.rows[0]['cnt']).toBe(1346912);
    });

    it('get temporary table name', async () => {
      const sql = 'SELECT 1 as T';
      const tempTableName = await conn.manifestTemporaryTable(sql);
      expect(tempTableName).toBeDefined();
      expect(tempTableName.startsWith('lofty-complex-452701')).toBe(true);
    });
  });
});
