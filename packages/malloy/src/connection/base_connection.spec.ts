/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SQLSourceRequest} from '../lang/translate-response';
import type {
  MalloyQueryData,
  SQLSourceDef,
  TableSourceDef,
} from '../model/malloy_types';
import {BaseConnection} from './base_connection';

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function tableSchema(name: string): TableSourceDef {
  return {
    type: 'table',
    name,
    dialect: 'test',
    tablePath: name,
    connection: 'test',
    fields: [],
  };
}

class CacheTestConnection extends BaseConnection {
  get name(): string {
    return 'test';
  }

  get dialectName(): string {
    return 'test';
  }

  getDigest(): string {
    return 'test';
  }

  async runSQL(): Promise<MalloyQueryData> {
    return {rows: [], totalRows: 0};
  }

  async fetchTableSchema(): Promise<TableSourceDef> {
    return tableSchema('test');
  }

  async fetchSelectSchema(
    _sqlSource: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    return 'not used';
  }

  check(
    key: string,
    fill: () => Promise<TableSourceDef | string>
  ): Promise<{schema?: TableSourceDef; error?: string}> {
    return this.checkSchemaCache(key, 'table', fill, undefined);
  }

  invalidate(): void {
    this.invalidateSchemaCache();
  }
}

describe('BaseConnection schema cache fencing', () => {
  it('does not let an older same-key fill overwrite a newer completed fill', async () => {
    const connection = new CacheTestConnection();
    const older = tableSchema('older');
    const newer = tableSchema('newer');
    const olderFill = deferred<TableSourceDef | string>();
    const newerFill = deferred<TableSourceDef | string>();

    const olderRequest = connection.check('same-key', () => olderFill.promise);
    const newerRequest = connection.check('same-key', () => newerFill.promise);
    newerFill.resolve(newer);
    await newerRequest;
    olderFill.resolve(older);
    await olderRequest;

    const unexpectedFill = jest.fn(async () => tableSchema('unexpected'));
    const cached = await connection.check('same-key', unexpectedFill);
    expect(cached.schema).toBe(newer);
    expect(unexpectedFill).not.toHaveBeenCalled();
  });

  it('does not let an old generation delete or overwrite a new fill token', async () => {
    const connection = new CacheTestConnection();
    const internals = connection as unknown as {
      schemaCacheInFlight: Map<string, symbol>;
    };
    const olderFill = deferred<TableSourceDef | string>();
    const newerFill = deferred<TableSourceDef | string>();
    const olderRequest = connection.check('same-key', () => olderFill.promise);

    connection.invalidate();
    const newer = tableSchema('new-generation');
    const newerRequest = connection.check('same-key', () => newerFill.promise);
    olderFill.resolve(tableSchema('old-generation'));
    await olderRequest;

    expect(internals.schemaCacheInFlight.has('same-key')).toBe(true);
    newerFill.resolve(newer);
    await newerRequest;
    expect(internals.schemaCacheInFlight.size).toBe(0);

    const unexpectedFill = jest.fn(async () => tableSchema('unexpected'));
    const cached = await connection.check('same-key', unexpectedFill);
    expect(cached.schema).toBe(newer);
    expect(unexpectedFill).not.toHaveBeenCalled();
  });

  it('releases in-flight tokens for unique failed keys', async () => {
    const connection = new CacheTestConnection();
    const internals = connection as unknown as {
      schemaCacheInFlight: Map<string, symbol>;
    };

    for (let index = 0; index < 32; index++) {
      await connection.check(`missing-${index}`, async () => 'missing');
    }
    await connection.check('thrown', async () => {
      throw new Error('injected schema failure');
    });

    expect(internals.schemaCacheInFlight.size).toBe(0);
  });
});
