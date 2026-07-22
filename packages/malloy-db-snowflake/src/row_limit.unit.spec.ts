/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SnowflakeConnection} from './snowflake_connection';

const mockBatch = jest.fn();

jest.mock('./snowflake_executor', () => ({
  SnowflakeExecutor: jest.fn().mockImplementation(() => ({
    batch: mockBatch,
  })),
}));

describe('Snowflake rowLimit', () => {
  afterEach(() => {
    mockBatch.mockReset();
  });

  it.each([
    ['configured value', undefined, 2],
    ['per-run override', 3, 3],
    ['zero', 0, 0],
  ])('applies %s', async (_name, perRunRowLimit, expectedRows) => {
    const connection = new SnowflakeConnection('snowflake', {
      connOptions: {
        account: 'test',
        username: 'test',
        password: 'test',
      },
      queryOptions: {rowLimit: 2},
    });
    mockBatch.mockResolvedValue(
      Array.from({length: 5}, (_, value) => ({value}))
    );
    const options =
      perRunRowLimit === undefined ? {} : {rowLimit: perRunRowLimit};

    const result = await connection.runSQL('SELECT value', options);

    expect(result.rows).toHaveLength(expectedRows);
    expect(mockBatch.mock.calls[0][1].rowLimit).toBe(expectedRows);
  });
});
