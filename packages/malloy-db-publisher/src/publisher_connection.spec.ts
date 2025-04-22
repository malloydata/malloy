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

// Mock the client module
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
  });
});
