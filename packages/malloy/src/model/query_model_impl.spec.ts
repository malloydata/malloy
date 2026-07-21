/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection} from '../connection/types';
import {TestTranslator} from '../lang/test/test-translator';
import {QueryModel} from './index';

describe('QueryModel search index TEMP capability', () => {
  it('retains deterministic manifest reuse when scoped TEMP is absent', async () => {
    const queryModel = makeSearchableQueryModel();
    const manifestTemporaryTable = jest.fn(async () => 'legacy_search_temp');
    const runSQL = jest.fn(async () => ({rows: [], totalRows: 0}));
    const connection = {
      canPersist: () => true,
      manifestTemporaryTable,
      runSQL,
      runSQLWithTemporaryTable: 'not-a-function',
    } as unknown as Connection;

    await expect(
      queryModel.searchIndex(connection, 'carriers', 'needle', 25)
    ).resolves.toEqual([]);

    expect(
      typeof (connection as unknown as {runSQLWithTemporaryTable?: unknown})
        .runSQLWithTemporaryTable
    ).not.toBe('function');
    expect(manifestTemporaryTable).toHaveBeenCalledTimes(1);
    expect(manifestTemporaryTable).toHaveBeenCalledWith(
      expect.stringContaining('malloytest.carriers')
    );
    expect(runSQL).toHaveBeenCalledWith(
      expect.stringContaining('legacy_search_temp'),
      {rowLimit: 1000}
    );
  });

  it('uses scoped TEMP atomically when the backend exposes it', async () => {
    const queryModel = makeSearchableQueryModel();
    const manifestTemporaryTable = jest.fn();
    const runSQL = jest.fn();
    let consumerSQL: string | undefined;
    const runSQLWithTemporaryTable = jest.fn(
      async (_sql: string, buildConsumerSQL: (tableName: string) => string) => {
        consumerSQL = buildConsumerSQL('scoped_search_temp');
        return {rows: [], totalRows: 0};
      }
    );
    const connection = {
      canPersist: () => true,
      manifestTemporaryTable,
      runSQL,
      runSQLWithTemporaryTable,
    } as unknown as Connection;

    await expect(
      queryModel.searchIndex(connection, 'carriers', 'needle', 25)
    ).resolves.toEqual([]);

    expect(runSQLWithTemporaryTable).toHaveBeenCalledWith(
      expect.stringContaining('malloytest.carriers'),
      expect.any(Function),
      {
        rowLimit: 1000,
        temporaryTableCache: 'connection-generation',
      }
    );
    expect(consumerSQL).toContain('scoped_search_temp');
    expect(manifestTemporaryTable).not.toHaveBeenCalled();
    expect(runSQL).not.toHaveBeenCalled();
  });
});

function makeSearchableQueryModel(): QueryModel {
  const translation = new TestTranslator(
    "source: carriers is _db_.table('malloytest.carriers')"
  ).translate();
  if (!translation.final || !translation.modelDef) {
    throw new Error('Failed to build the search-index test model');
  }
  return new QueryModel(translation.modelDef);
}
