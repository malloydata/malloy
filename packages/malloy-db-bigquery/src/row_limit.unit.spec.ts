/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryResultsOptions} from '@google-cloud/bigquery';
import {BigQueryConnection} from './bigquery_connection';

type BigQueryJobResult = [
  Array<{value: number}>,
  undefined,
  {totalRows: string; schema: {fields: []}},
];

type TestableBigQueryConnection = {
  createBigQueryJobAndGetResults(
    sql: string,
    jobId?: string,
    options?: QueryResultsOptions
  ): Promise<BigQueryJobResult>;
};

describe('BigQuery rowLimit', () => {
  it.each([
    ['configured value', undefined, 2],
    ['per-run override', 3, 3],
    ['zero', 0, 0],
  ])('applies %s', async (_name, perRunRowLimit, expectedRows) => {
    const connection = new BigQueryConnection('bigquery', {rowLimit: 2});
    const getResults = jest
      .spyOn(
        connection as unknown as TestableBigQueryConnection,
        'createBigQueryJobAndGetResults'
      )
      .mockResolvedValue([
        Array.from({length: 5}, (_, value) => ({value})),
        undefined,
        {totalRows: '5', schema: {fields: []}},
      ]);
    const options =
      perRunRowLimit === undefined ? {} : {rowLimit: perRunRowLimit};

    const result = await connection.runSQL('SELECT value', options);

    expect(result.rows).toHaveLength(expectedRows);
    expect(getResults.mock.calls[0][2]?.maxResults).toBe(
      Math.max(expectedRows, 1)
    );
  });
});
