/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DatabricksConnection} from './databricks_connection';

type TestableDatabricksConnection = {
  executeLimited(sql: string, rowLimit: number): Promise<object[]>;
};

type DatabricksOperation = {
  fetchAll: jest.Mock;
  fetchChunk: jest.Mock;
  finished: jest.Mock;
  close: jest.Mock;
};

describe('Databricks rowLimit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['configured value', undefined, 2],
    ['per-run override', 3, 3],
    ['zero', 0, 0],
  ])('applies %s', async (_name, perRunRowLimit, expectedRows) => {
    const connection = new DatabricksConnection(
      'databricks',
      {host: '', path: ''},
      {rowLimit: 2}
    );
    const executeLimited = jest
      .spyOn(
        connection as unknown as TestableDatabricksConnection,
        'executeLimited'
      )
      .mockResolvedValue(
        Array.from({length: expectedRows}, (_, value) => ({value}))
      );
    const options =
      perRunRowLimit === undefined ? {} : {rowLimit: perRunRowLimit};

    const result = await connection.runSQL('SELECT value', options);

    expect(result.rows).toHaveLength(expectedRows);
    expect(result.totalRows).toBe(expectedRows);
    expect(executeLimited).toHaveBeenCalledWith('SELECT value', expectedRows);
  });

  it('fetches one bounded chunk and closes the operation', async () => {
    const connection = new DatabricksConnection('databricks', {
      host: '',
      path: '',
    });
    const operation: DatabricksOperation = {
      fetchAll: jest.fn(),
      fetchChunk: jest.fn(async () => [{value: 1}, {value: 2}]),
      finished: jest.fn(),
      close: jest.fn(),
    };
    const executeStatement = jest.fn(async () => operation);
    (
      connection as unknown as {
        session: {executeStatement: typeof executeStatement};
      }
    ).session = {executeStatement};

    const rows = await (
      connection as unknown as TestableDatabricksConnection
    ).executeLimited('SELECT value', 2);

    expect(rows).toHaveLength(2);
    expect(operation.fetchChunk).toHaveBeenCalledWith({maxRows: 2});
    expect(operation.fetchAll).not.toHaveBeenCalled();
    expect(operation.close).toHaveBeenCalledTimes(1);
  });

  it('waits for a zero-row statement without fetching and then closes', async () => {
    const connection = new DatabricksConnection('databricks', {
      host: '',
      path: '',
    });
    const operation: DatabricksOperation = {
      fetchAll: jest.fn(),
      fetchChunk: jest.fn(),
      finished: jest.fn(),
      close: jest.fn(),
    };
    const executeStatement = jest.fn(async () => operation);
    (
      connection as unknown as {
        session: {executeStatement: typeof executeStatement};
      }
    ).session = {executeStatement};

    const rows = await (
      connection as unknown as TestableDatabricksConnection
    ).executeLimited('SELECT value', 0);

    expect(rows).toEqual([]);
    expect(operation.finished).toHaveBeenCalledTimes(1);
    expect(operation.fetchChunk).not.toHaveBeenCalled();
    expect(operation.fetchAll).not.toHaveBeenCalled();
    expect(operation.close).toHaveBeenCalledTimes(1);
  });
});
