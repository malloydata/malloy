/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {RunSQLOptions} from '@malloydata/malloy';
import type {BaseRunner} from '@malloydata/db-trino';
import type {
  AthenaClientConfig,
  ColumnInfo,
  Datum,
  QueryExecution,
} from '@aws-sdk/client-athena';
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
  StopQueryExecutionCommand,
} from '@aws-sdk/client-athena';

export interface AthenaConnectionConfiguration {
  region?: string;
  workGroup?: string;
  catalog?: string;
  database?: string;
  // Where Athena writes result files. A workgroup that enforces its own
  // location rejects a statement that names another, so leave this unset for
  // such a workgroup.
  outputLocation?: string;
  // Serve a statement identical to one that read the same tables within this
  // many minutes from that earlier result instead of running it again.
  resultReuseMaxAgeMinutes?: number;
  // Static credentials; when absent the SDK's default provider chain applies
  // (environment, shared config/SSO, instance or pod role).
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

// The one AthenaClient method the runner calls, so a test can answer it with
// recorded responses.
export type AthenaCommandSender = Pick<AthenaClient, 'send'>;

// GetQueryResults returns at most this many rows per page.
const RESULT_PAGE_SIZE = 1000;
const FIRST_POLL_MS = 50;
const MAX_POLL_MS = 1000;

function clientConfig(
  config: AthenaConnectionConfiguration
): AthenaClientConfig {
  const clientConfig: AthenaClientConfig = {region: config.region};
  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
    };
  }
  return clientConfig;
}

function errorText(e: unknown): string {
  if (e instanceof Error) {
    return e.name && e.name !== 'Error' ? `${e.name}: ${e.message}` : e.message;
  }
  return String(e);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Column types whose text Number() reads exactly as Athena spells it,
// including `NaN`, `Infinity` and `-Infinity`. bigint text is exact past 2^53
// where a JS number is not; Malloy reads a number, so the dialect declares
// supportsBigIntPrecision = false.
const NUMBER_TYPES = new Set([
  'tinyint',
  'smallint',
  'integer',
  'bigint',
  'real',
  'float',
  'double',
  'decimal',
]);

/**
 * Every cell of a GetQueryResults page is text (`VarCharValue`), typed only
 * by the column's `ColumnInfo.Type`; a NULL is a datum with no value at all.
 * A json column's text is parsed, so Malloy reads the value rather than the
 * text, as it does the row_to_json output Postgres's connection hands it.
 * Text that the shared Trino/Presto row converter already reads (dates,
 * timestamps) is passed through as text.
 */
export function decodeCell(
  column: ColumnInfo,
  datum: Datum | undefined
): unknown {
  const text = datum?.VarCharValue;
  if (text === undefined) {
    return null;
  }
  const type = column.Type?.toLowerCase() ?? '';
  if (type === 'boolean') {
    return text === 'true';
  }
  if (NUMBER_TYPES.has(type)) {
    return Number(text);
  }
  if (type === 'json') {
    return JSON.parse(text);
  }
  return text;
}

/**
 * Runs a statement through the Athena API: StartQueryExecution, poll
 * GetQueryExecution until the state is terminal, then page GetQueryResults.
 * A SELECT or EXPLAIN result (`StatementType` DML) carries the column names
 * as row 0 of its first page; DESCRIBE, SHOW and DDL results do not.
 */
export class AthenaRunner implements BaseRunner {
  private readonly client: AthenaCommandSender;
  // The most recent execution Athena reported, with its engine version and
  // statistics.
  lastExecution?: QueryExecution;

  constructor(
    private readonly config: AthenaConnectionConfiguration,
    client?: AthenaCommandSender
  ) {
    this.client = client ?? new AthenaClient(clientConfig(config));
  }

  async runSQL(
    sql: string,
    options: RunSQLOptions = {},
    queryMetadataComment = ''
  ): Promise<{
    rows: unknown[][];
    columns: {name: string; type: string}[];
    error?: string;
  }> {
    const none = {rows: [], columns: []};
    let queryExecutionId: string | undefined;
    try {
      const started = await this.client.send(
        new StartQueryExecutionCommand({
          QueryString: queryMetadataComment + sql,
          WorkGroup: this.config.workGroup,
          QueryExecutionContext: {
            Catalog: this.config.catalog,
            Database: this.config.database,
          },
          ResultConfiguration: this.config.outputLocation
            ? {OutputLocation: this.config.outputLocation}
            : undefined,
          ResultReuseConfiguration:
            this.config.resultReuseMaxAgeMinutes !== undefined
              ? {
                  ResultReuseByAgeConfiguration: {
                    Enabled: true,
                    MaxAgeInMinutes: this.config.resultReuseMaxAgeMinutes,
                  },
                }
              : undefined,
        })
      );
      queryExecutionId = started.QueryExecutionId;
    } catch (e) {
      // The parser runs at submission: a malformed statement, a missing table
      // in DESCRIBE, or a rejected CTAS location never gets an execution.
      return {...none, error: errorText(e)};
    }
    if (queryExecutionId === undefined) {
      return {...none, error: 'Athena returned no QueryExecutionId'};
    }

    try {
      const execution = await this.waitUntilDone(
        queryExecutionId,
        options.abortSignal
      );
      this.lastExecution = execution;
      const status = execution.Status;
      if (status?.State !== 'SUCCEEDED') {
        return {
          ...none,
          error:
            status?.StateChangeReason ??
            `Athena query ${status?.State ?? 'ended'} with no reason given`,
        };
      }
      return await this.fetchRows(
        queryExecutionId,
        execution.StatementType === 'DML',
        options.rowLimit
      );
    } catch (e) {
      // GetQueryExecution and GetQueryResults are rate-limited per account;
      // a throttle the SDK's own retries did not clear is an expected failure.
      return {...none, error: errorText(e)};
    }
  }

  private async waitUntilDone(
    queryExecutionId: string,
    abortSignal?: AbortSignal
  ): Promise<QueryExecution> {
    let delay = FIRST_POLL_MS;
    for (;;) {
      if (abortSignal?.aborted) {
        await this.client.send(
          new StopQueryExecutionCommand({QueryExecutionId: queryExecutionId})
        );
        return {
          QueryExecutionId: queryExecutionId,
          Status: {
            State: 'CANCELLED',
            StateChangeReason: 'Query cancelled by the caller',
          },
        };
      }
      const {QueryExecution: execution} = await this.client.send(
        new GetQueryExecutionCommand({QueryExecutionId: queryExecutionId})
      );
      const state = execution?.Status?.State;
      if (execution && state !== 'QUEUED' && state !== 'RUNNING') {
        return execution;
      }
      await sleep(delay);
      delay = Math.min(delay * 2, MAX_POLL_MS);
    }
  }

  // rowLimit stops fetching pages; the statement runs whole. Wrapping it in
  // `SELECT * FROM (...) LIMIT n` would let the engine drop the query's own
  // ORDER BY, which a subquery does not guarantee to keep.
  private async fetchRows(
    queryExecutionId: string,
    hasHeaderRow: boolean,
    rowLimit: number | undefined
  ): Promise<{rows: unknown[][]; columns: {name: string; type: string}[]}> {
    let columnInfo: ColumnInfo[] = [];
    const rows: unknown[][] = [];
    let nextToken: string | undefined;
    let firstPage = true;
    do {
      const page = await this.client.send(
        new GetQueryResultsCommand({
          QueryExecutionId: queryExecutionId,
          MaxResults: RESULT_PAGE_SIZE,
          NextToken: nextToken,
        })
      );
      if (firstPage) {
        columnInfo = page.ResultSet?.ResultSetMetadata?.ColumnInfo ?? [];
      }
      const pageRows = page.ResultSet?.Rows ?? [];
      for (const row of firstPage && hasHeaderRow
        ? pageRows.slice(1)
        : pageRows) {
        if (rowLimit !== undefined && rows.length >= rowLimit) {
          break;
        }
        rows.push(
          columnInfo.map((column, i) => decodeCell(column, row.Data?.[i]))
        );
      }
      firstPage = false;
      nextToken = page.NextToken;
    } while (
      nextToken !== undefined &&
      (rowLimit === undefined || rows.length < rowLimit)
    );
    return {rows, columns: columnInfo.map(columnType)};
  }
}

// ColumnInfo spells a decimal as bare `decimal` with its precision and scale
// in their own fields; the shared type parser reads `decimal(p,s)`.
function columnType(column: ColumnInfo): {name: string; type: string} {
  const type = column.Type ?? '';
  return {
    name: column.Name ?? '',
    type:
      type === 'decimal' && column.Precision !== undefined
        ? `decimal(${column.Precision},${column.Scale ?? 0})`
        : type,
  };
}
