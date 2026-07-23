/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// PrestoClient is mocked so we can inspect the SQL the driver sends without a
// live server.
jest.mock('@prestodb/presto-js-client', () => ({
  PrestoClient: jest.fn().mockImplementation(() => ({query: jest.fn()})),
}));

import {PrestoClient} from '@prestodb/presto-js-client';
import {Trino} from 'trino-client';
import {PrestoConnection, TrinoConnection} from './trino_connection';

const PrestoClientMock = PrestoClient as unknown as jest.Mock;

// A Trino client mock whose `query` we can inspect; one result page, done.
function fakeTrinoClient(): {query: jest.Mock} {
  return {
    query: jest.fn().mockReturnValue({
      next: async () => ({
        value: {columns: [], data: [], id: 'q1'},
        done: true,
      }),
    }),
  };
}

describe('db-trino queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('request side — bag prepended as a leading comment', () => {
    it('Trino: prepends the metadata comment to the query', async () => {
      const client = fakeTrinoClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(Trino, 'create').mockReturnValue(client as any);
      const conn = new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
      });
      await conn.runSQL('SELECT 1', {queryMetadata: {team: 'finance'}});
      expect(client.query).toHaveBeenCalledWith('-- team="finance"\nSELECT 1');
    });

    it('Trino: sends the query unchanged when there is no metadata', async () => {
      const client = fakeTrinoClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(Trino, 'create').mockReturnValue(client as any);
      const conn = new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
      });
      await conn.runSQL('SELECT 1');
      expect(client.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('Trino: rejects a value that violates the malloy contract (newline)', async () => {
      const client = fakeTrinoClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(Trino, 'create').mockReturnValue(client as any);
      const conn = new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
      });
      await expect(
        conn.runSQL('SELECT 1', {queryMetadata: {evil: 'a\nb'}})
      ).rejects.toThrow(/Invalid query metadata/);
    });

    it('Presto: prepends the metadata comment to the query', async () => {
      PrestoClientMock.mockClear();
      const conn = new PrestoConnection('p', undefined, {server: 'localhost'});
      await conn.runSQL('SELECT 1', {queryMetadata: {team: 'finance'}});
      const queryFn = PrestoClientMock.mock.results[0].value.query as jest.Mock;
      expect(queryFn).toHaveBeenCalledWith('-- team="finance"\nSELECT 1');
    });
  });
});
