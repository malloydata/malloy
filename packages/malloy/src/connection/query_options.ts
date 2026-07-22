/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryOptionsReader, RunSQLOptions} from '../run_sql_options';
import type {ConnectionPropertyDefinition} from './registry';
import type {ConnectionConfig} from './types';

export const DEFAULT_ROW_LIMIT = 1000;

export interface ResolvedRunSQLOptions extends RunSQLOptions {
  rowLimit: number;
}

/** Shared `malloy-config.json` property for database connection row limits. */
export const ROW_LIMIT_CONNECTION_PROPERTY: ConnectionPropertyDefinition = {
  name: 'rowLimit',
  displayName: 'Default Row Limit',
  type: 'number',
  optional: true,
  advanced: true,
  default: DEFAULT_ROW_LIMIT,
  description:
    'Maximum number of rows returned by this connection unless overridden for an individual query run.',
};

function assertRowLimit(
  value: unknown,
  label: string
): asserts value is number {
  if (typeof value !== 'number') {
    throw new TypeError(`${label} must be a number`);
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

/**
 * Read and validate the connection-level row limit at the factory boundary.
 *
 * `MalloyConfig` applies registered property defaults before calling a factory,
 * but the legacy `createConnectionsFromConfig` path calls factories directly.
 * Keeping the fallback here makes both paths behave the same.
 */
export function queryOptionsFromConnectionConfig(
  config: ConnectionConfig
): RunSQLOptions {
  const configuredRowLimit = config['rowLimit'];
  const rowLimit =
    configuredRowLimit === undefined ? DEFAULT_ROW_LIMIT : configuredRowLimit;
  assertRowLimit(rowLimit, `Connection "${config.name}" rowLimit`);
  return {rowLimit};
}

/** Resolve per-run options over connection options and the shared default. */
export function resolveRunSQLOptions(
  queryOptions?: QueryOptionsReader,
  runOptions: RunSQLOptions = {}
): ResolvedRunSQLOptions {
  const connectionOptions =
    typeof queryOptions === 'function' ? queryOptions() : queryOptions;

  if (connectionOptions?.rowLimit !== undefined) {
    assertRowLimit(connectionOptions.rowLimit, 'Configured rowLimit');
  }
  if (runOptions.rowLimit !== undefined) {
    assertRowLimit(runOptions.rowLimit, 'Per-run rowLimit');
  }

  const rowLimit =
    runOptions.rowLimit ?? connectionOptions?.rowLimit ?? DEFAULT_ROW_LIMIT;
  const abortSignal = runOptions.abortSignal ?? connectionOptions?.abortSignal;

  return abortSignal === undefined ? {rowLimit} : {rowLimit, abortSignal};
}
