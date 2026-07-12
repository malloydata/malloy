/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Readable} from 'stream';

const mockCreatePool = jest.fn();

jest.mock('snowflake-sdk', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    createPool: (...args: unknown[]) => mockCreatePool(...args),
  },
}));

import {SnowflakeExecutor} from './snowflake_executor';

describe('SnowflakeExecutor streaming rowLimit', () => {
  it('returns no rows and cancels the stream when rowLimit is zero', async () => {
    type StatementDouble = {
      cancel: jest.Mock;
      streamRows: jest.Mock;
    };
    const cancel = jest.fn();
    const streamRows = jest.fn(() =>
      Readable.from([{value: 1}, {value: 2}], {objectMode: true})
    );
    const statement: StatementDouble = {cancel, streamRows};
    const connection = {
      execute: jest.fn(
        (options: {
          complete: (error: undefined, statement: StatementDouble) => void;
        }) => {
          queueMicrotask(() => options.complete(undefined, statement));
          return statement;
        }
      ),
    };
    const pool = {
      acquire: jest.fn(async () => connection),
      release: jest.fn(async () => undefined),
    };
    mockCreatePool.mockReturnValue(pool);

    const executor = new SnowflakeExecutor({account: 'test'});
    (
      executor as unknown as {
        sessionInitialized: WeakMap<object, Promise<void>>;
      }
    ).sessionInitialized.set(connection, Promise.resolve());

    const rows: unknown[] = [];
    for await (const row of await executor.stream('SELECT value', {
      rowLimit: 0,
    })) {
      rows.push(row);
    }

    expect(rows).toEqual([]);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledWith(connection);
  });
});
