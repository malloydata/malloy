/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// PrestoClient is mocked so we can inspect the client config the driver builds
// (request-side client tags / source) without a live server.
jest.mock('@prestodb/presto-js-client', () => ({
  PrestoClient: jest.fn().mockImplementation(() => ({query: jest.fn()})),
}));

import {PrestoClient} from '@prestodb/presto-js-client';
import {Trino} from 'trino-client';
import type {BaseRunner} from './trino_connection';
import {PrestoConnection, TrinoConnection} from './trino_connection';

const PrestoClientMock = PrestoClient as unknown as jest.Mock;

// A BaseRunner that returns a fixed result (with a query id) and no network.
function fakeRunner(queryId?: string): BaseRunner {
  return {
    runSQL: async () => ({
      rows: [['hello']],
      columns: [{name: 'c', type: 'varchar'}],
      queryId,
    }),
  };
}

describe('db-trino queryMetadata wiring (offline)', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('request side — applicationName -> source, labels -> client tags', () => {
    it('Trino: maps applicationName to source and labels to X-Trino-Client-Tags', () => {
      const createSpy = jest
        .spyOn(Trino, 'create')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValue({} as any);
      new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
        queryMetadata: {
          applicationName: 'my-app',
          labels: {team: 'finance', env: 'prod'},
        },
      });
      const opts = createSpy.mock.calls[0][0] as {
        source?: string;
        extraHeaders?: Record<string, string>;
      };
      expect(opts.source).toBe('my-app');
      expect(opts.extraHeaders?.['X-Trino-Client-Tags']).toBe(
        'team:finance,env:prod'
      );
    });

    it('Trino: sets no client-tags header when there are no labels', () => {
      const createSpy = jest
        .spyOn(Trino, 'create')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValue({} as any);
      new TrinoConnection('t', undefined, {server: 'http://localhost:8080'});
      const opts = createSpy.mock.calls[0][0] as {
        extraHeaders?: Record<string, string>;
      };
      expect(opts.extraHeaders?.['X-Trino-Client-Tags']).toBeUndefined();
    });

    it('Trino: rejects a value that violates the malloy contract (newline)', () => {
      jest
        .spyOn(Trino, 'create')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValue({} as any);
      expect(
        () =>
          new TrinoConnection('t', undefined, {
            server: 'http://localhost:8080',
            queryMetadata: {labels: {ok: 'v', evil: 'a\nb'}},
          })
      ).toThrow(/Invalid query metadata/);
    });

    it('Trino: drops a (contract-valid) label whose value contains the tag separator', () => {
      const createSpy = jest
        .spyOn(Trino, 'create')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValue({} as any);
      new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
        queryMetadata: {labels: {ok: 'v', csv: 'a,b'}},
      });
      const opts = createSpy.mock.calls[0][0] as {
        extraHeaders?: Record<string, string>;
      };
      expect(opts.extraHeaders?.['X-Trino-Client-Tags']).toBe('ok:v');
    });

    it('Presto: maps applicationName to source and labels to X-Presto-Client-Tags', () => {
      PrestoClientMock.mockClear();
      new PrestoConnection('p', undefined, {
        server: 'localhost',
        queryMetadata: {
          applicationName: 'my-app',
          labels: {team: 'finance', env: 'prod'},
        },
      });
      const cfg = PrestoClientMock.mock.calls[0][0] as {
        source?: string;
        extraHeaders?: Record<string, string>;
      };
      expect(cfg.source).toBe('my-app');
      expect(cfg.extraHeaders?.['X-Presto-Client-Tags']).toBe(
        'team:finance,env:prod'
      );
    });
  });

  describe('response side — query id into runStats.executionId', () => {
    it('Trino: surfaces the query id', async () => {
      jest
        .spyOn(Trino, 'create')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValue({} as any);
      const conn = new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn as any).client = fakeRunner('20240101_000001_abcde');
      const res = await conn.runSQL('SELECT 1');
      expect(res.runStats?.executionId).toBe('20240101_000001_abcde');
    });

    it('Presto: surfaces the query id', async () => {
      const conn = new PrestoConnection('p', undefined, {server: 'localhost'});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn as any).client = fakeRunner('20240101_000002_fghij');
      const res = await conn.runSQL('SELECT 1');
      expect(res.runStats?.executionId).toBe('20240101_000002_fghij');
    });

    it('omits runStats when the runner reports no query id', async () => {
      jest
        .spyOn(Trino, 'create')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValue({} as any);
      const conn = new TrinoConnection('t', undefined, {
        server: 'http://localhost:8080',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conn as any).client = fakeRunner(undefined);
      const res = await conn.runSQL('SELECT 1');
      expect(res.runStats).toBeUndefined();
    });
  });
});
