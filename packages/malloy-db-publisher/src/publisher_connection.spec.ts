import * as malloy from '@malloydata/malloy';
import {describeIfDatabaseAvailable} from '@malloydata/malloy/test';
import {PublisherConnection} from './publisher_connection';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as fs from 'fs';
import {Configuration, ConnectionAttributes, ConnectionsApi} from './client';
import {jest} from '@jest/globals';
import {AxiosResponse} from 'axios';

// Mock the client module
jest.mock('./client', () => {
  const mockConnectionsApi = {
    getConnection: jest.fn(),
    getTest: jest.fn(),
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
  });
});
