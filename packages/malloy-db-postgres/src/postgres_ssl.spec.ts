/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

const mockClient = jest.fn();
const mockPool = jest.fn();
const mockClientConnect = jest.fn();
const mockPoolQuery = jest.fn();

jest.mock('pg', () => ({
  Client: jest.fn().mockImplementation(config => {
    mockClient(config);
    return {
      connect: mockClientConnect,
      query: jest.fn().mockResolvedValue({rows: [], fields: []}),
      end: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
  }),
  Pool: jest.fn().mockImplementation(config => {
    mockPool(config);
    return {
      query: mockPoolQuery,
      connect: jest.fn(),
      on: jest.fn(),
    };
  }),
}));

import {
  PostgresConnection,
  PooledPostgresConnection,
} from './postgres_connection';
import type {PostgresConnectionOptions} from './postgres_connection';

// getClient/getPool are protected — reach them through a thin subclass.
class TestablePostgresConnection extends PostgresConnection {
  public async testGetClient() {
    return this.getClient();
  }
}

class TestablePooledPostgresConnection extends PooledPostgresConnection {
  public async testGetPool() {
    return this.getPool();
  }
}

function makeOptions(
  overrides: Partial<PostgresConnectionOptions>
): PostgresConnectionOptions {
  return {
    name: 'ssl_test',
    ...overrides,
  };
}

function altnameError(): Error {
  const e = new Error(
    "Hostname/IP does not match certificate's altnames: Host: localhost. is not in the cert's altnames: DNS:db.example.com"
  );
  (e as {code?: string}).code = 'ERR_TLS_CERT_ALTNAME_INVALID';
  return e;
}

describe('postgres ssl passthrough', () => {
  beforeEach(() => {
    mockClientConnect.mockResolvedValue(undefined);
    mockPoolQuery.mockResolvedValue({rows: [], fields: []});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forwarding', () => {
    it('forwards an ssl object to the Client config', async () => {
      const ssl = {servername: '127.0.0.1', ca: 'PEM'};
      const connection = new TestablePostgresConnection(
        makeOptions({host: '127.0.0.1', ssl})
      );
      await connection.testGetClient();
      expect(mockClient).toHaveBeenCalledTimes(1);
      expect(mockClient.mock.calls[0][0].ssl).toEqual(ssl);
    });

    it('forwards an ssl object to the Pool config', async () => {
      const ssl = {servername: '127.0.0.1', ca: 'PEM'};
      const connection = new TestablePooledPostgresConnection(
        makeOptions({host: '127.0.0.1', ssl})
      );
      await connection.testGetPool();
      expect(mockPool).toHaveBeenCalledTimes(1);
      expect(mockPool.mock.calls[0][0].ssl).toEqual(ssl);
    });

    it('forwards ssl: true to the Client config', async () => {
      const connection = new TestablePostgresConnection(
        makeOptions({host: '127.0.0.1', ssl: true})
      );
      await connection.testGetClient();
      expect(mockClient.mock.calls[0][0].ssl).toBe(true);
    });

    it('forwards ssl: true to the Pool config', async () => {
      const connection = new TestablePooledPostgresConnection(
        makeOptions({host: '127.0.0.1', ssl: true})
      );
      await connection.testGetPool();
      expect(mockPool.mock.calls[0][0].ssl).toBe(true);
    });

    it('leaves ssl undefined when unset (Client) — regression guard', async () => {
      const connection = new TestablePostgresConnection(
        makeOptions({host: '127.0.0.1'})
      );
      await connection.testGetClient();
      expect(mockClient.mock.calls[0][0].ssl).toBeUndefined();
    });

    it('leaves ssl undefined when unset (Pool) — regression guard', async () => {
      const connection = new TestablePooledPostgresConnection(
        makeOptions({host: '127.0.0.1'})
      );
      await connection.testGetPool();
      expect(mockPool.mock.calls[0][0].ssl).toBeUndefined();
    });

    // Guards the field remapping in buildClientConfig (username→user,
    // databaseName→database) so the ssl refactor can't silently drop them.
    it('preserves the non-ssl field mapping', async () => {
      const connection = new TestablePostgresConnection(
        makeOptions({
          host: 'db.example.com',
          port: 5433,
          username: 'me',
          password: 'pw',
          databaseName: 'analytics',
          connectionString: 'postgres://db.example.com/analytics',
        })
      );
      await connection.testGetClient();
      expect(mockClient.mock.calls[0][0]).toMatchObject({
        user: 'me',
        password: 'pw',
        database: 'analytics',
        port: 5433,
        host: 'db.example.com',
        connectionString: 'postgres://db.example.com/analytics',
      });
    });
  });

  // pg verifies the cert against the host it connects to, not ssl.servername,
  // and throws a terse altname error on mismatch. The connector reacts to that
  // real error rather than predicting pg's host resolution up front.
  describe('certificate-mismatch error annotation', () => {
    it('annotates pg cert-mismatch on the non-pooled path', async () => {
      mockClientConnect.mockRejectedValueOnce(altnameError());
      const connection = new PostgresConnection(
        makeOptions({host: 'localhost', ssl: {servername: 'db.example.com'}})
      );
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        /does not match the host pg connected to/
      );
    });

    it('annotates pg cert-mismatch on the pooled path', async () => {
      mockPoolQuery.mockRejectedValueOnce(altnameError());
      const connection = new PooledPostgresConnection(
        makeOptions({host: 'localhost', ssl: {servername: 'db.example.com'}})
      );
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        /does not match the host pg connected to/
      );
    });

    it('preserves the original error message when annotating', async () => {
      mockClientConnect.mockRejectedValueOnce(altnameError());
      const connection = new PostgresConnection(
        makeOptions({host: 'localhost', ssl: {servername: 'db.example.com'}})
      );
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        /does not match certificate's altnames/
      );
    });

    it('leaves unrelated connection errors unchanged', async () => {
      mockClientConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const connection = new PostgresConnection(
        makeOptions({host: 'localhost'})
      );
      await expect(connection.runSQL('SELECT 1')).rejects.toThrow(
        /^ECONNREFUSED$/
      );
    });
  });
});
