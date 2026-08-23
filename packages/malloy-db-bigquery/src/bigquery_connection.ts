/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  BigQueryOptions,
  Job,
  PagedResponse,
  Query,
  QueryResultsOptions,
  RowMetadata,
} from '@google-cloud/bigquery';
import {BigQuery as BigQuerySDK} from '@google-cloud/bigquery';
import type bigquery from '@google-cloud/bigquery/build/src/types';
import type {ResourceStream} from '@google-cloud/paginator';
import * as googleCommon from '@google-cloud/common';
import {GaxiosError} from 'gaxios';
import type {
  Connection,
  ConnectionConfig,
  ConnectionConfigEntry,
  ConnectionParameterValue,
  MalloyQueryData,
  PersistSQLResults,
  QueryData,
  QueryRecord,
  QueryMetadata,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  StreamingConnection,
  TableSourceDef,
  StructDef,
  SQLSourceDef,
  SQLSourceRequest,
} from '@malloydata/malloy';
import {
  mkArrayDef,
  Malloy,
  StandardSQLDialect,
  toAsyncGenerator,
  sqlKey,
  makeDigest,
  decodeDottedTablePath,
} from '@malloydata/malloy';
import type {TableMetadata} from '@malloydata/malloy/connection';
import {BaseConnection} from '@malloydata/malloy/connection';

export interface BigQueryManagerOptions {
  credentials?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string | null;
  };
  projectId?: string | undefined;
  userAgent: string;
}

// From BigQuery/Google Auth SDK
interface CredentialBody {
  client_email?: string;
  private_key?: string;
}

/**
 * A caller-supplied credential. Anything Malloy cannot build from config text
 * — impersonation, workload identity federation, a proxied or test credential
 * — arrives as one of these, from a host overlay.
 */
type AuthClient = BigQueryOptions['authClient'];

/**
 * What to hash for the auth client, given the connection's unresolved config.
 *
 * An `AuthClient` is a live object with nothing stable to hash, so the digest
 * uses the reference the config named it by — `{tenantAuth: "acme"}`. Without
 * it, two connections against the same project holding different impersonated
 * identities produce the same digest, and so the same BuildIDs, and one
 * tenant is served rows persisted for another.
 *
 * The digest is therefore only as distinguishing as the reference path: an
 * overlay whose path doesn't vary by identity leaves them indistinguishable
 * here too.
 */
function authIdentityOf(
  rawConfigData: ConnectionConfigEntry | undefined
): string | undefined {
  const reference = rawConfigData?.['authClient'];
  return reference === undefined ? undefined : JSON.stringify(reference);
}

/**
 * An `authClient` and a service account key are two answers to one question,
 * and the SDK does not treat them as competing: `GoogleAuth` caches the
 * `authClient` and never consults `credentials` or `keyFilename` again
 * (`google-auth-library`, `googleauth.js`: `cachedCredential = opts.authClient`).
 * A config carrying both therefore runs entirely on the auth client while the
 * key sits there looking live, and whoever wrote it believes the wrong
 * identity is executing their queries. Refuse it instead.
 */
function rejectCompetingCredentials(
  name: string,
  config: BigQueryConnectionConfiguration
): void {
  if (config.authClient === undefined) return;
  const alsoSet = [
    config.credentials !== undefined ? 'a service account key' : undefined,
    config.serviceAccountKeyPath !== undefined
      ? 'serviceAccountKeyPath'
      : undefined,
  ].filter(what => what !== undefined);
  if (alsoSet.length === 0) return;
  throw new Error(
    `Connection "${name}" sets authClient and also ${alsoSet.join(' and ')}. ` +
      'An authClient replaces the credential entirely — the key would be ' +
      'ignored — so supply one or the other.'
  );
}

interface BigQueryConnectionConfiguration {
  /** This ID is used for Bigquery Table Normalization */
  projectId?: string;
  serviceAccountKeyPath?: string;
  location?: string;
  maximumBytesBilled?: string;
  timeoutMs?: string;
  billingProjectId?: string;
  credentials?: CredentialBody | {[key: string]: ConnectionParameterValue};
  authClient?: AuthClient;
  setupSQL?: string;
}

interface BigQueryConnectionOptions extends ConnectionConfig {
  /** This ID is used for Bigquery Table Normalization */
  projectId?: string;
  serviceAccountKeyPath?: string;
  serviceAccountKey?: {[key: string]: ConnectionParameterValue};
  /** The key file's contents, as a JSON string or base64-encoded JSON. */
  serviceAccountKeyJson?: string;
  authClient?: AuthClient;
  /**
   * The connection's entry as written, before overlay resolution. Set by the
   * registered factory; needed only so `getDigest` can identify which auth
   * client this connection got. See `authIdentityOf`.
   */
  rawConfigData?: ConnectionConfigEntry;
  location?: string;
  maximumBytesBilled?: string;
  timeoutMs?: string;
  billingProjectId?: string;
  client_email?: string;
  private_key?: string;
  setupSQL?: string;
}

type JsonObject = {[key: string]: ConnectionParameterValue};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The two credential shapes the SDK's `credentials` option accepts: a service
 * account key, and an external account (workload identity federation) config,
 * which carries no key of its own. Anything else — `{}`, a config file, half a
 * key — is rejected here rather than at the first query, where it arrives as
 * "the incoming JSON object does not contain a client_email field" and names
 * nothing that would lead back to this property.
 */
function isCredentialObject(value: JsonObject): boolean {
  return (
    (typeof value['client_email'] === 'string' &&
      typeof value['private_key'] === 'string') ||
    value['type'] === 'external_account'
  );
}

function isProbablyBase64(text: string): boolean {
  // `{` is not in the base64 alphabet, so JSON can never be mistaken for an
  // encoding of itself. Everything else is treated as base64 and allowed to
  // fail the parse below, which keeps the check to the one thing it can be
  // certain about.
  return !text.startsWith('{');
}

/**
 * A service account key that arrives as a *string* rather than as structured
 * config, in either of the two encodings a deployment can produce.
 *
 * `serviceAccountKey` is a `json`-typed property, and a json-typed slot takes
 * its value literally: an `{env: "..."}` reference is never resolved in one,
 * because reference indirection into structured config is exactly what the
 * config compiler refuses. A deployment whose credentials live in an
 * environment variable — the normal shape for a server — therefore cannot
 * reach that slot at all, and the literal `{env: "..."}` object it does reach
 * the SDK with fails as "the incoming JSON object does not contain a
 * client_email field". This is a string slot, so a reference resolves and the
 * value arrives here to be parsed.
 *
 * Base64 is accepted because a JSON object full of quotes and braces survives
 * a shell, a CI secret editor, and a `.env` file poorly; base64 is one token
 * that survives all three. Which one arrived is detected rather than declared,
 * so a deployment that switches encodings doesn't also have to edit config.
 *
 * Nothing from `text` reaches the error message. It is a private key, and
 * JSON.parse's own SyntaxError quotes the input it choked on.
 */
function credentialsFromJson(text: string): JsonObject {
  // Buffer's base64 decoder drops characters outside the alphabet rather than
  // rejecting them, so a mangled value decodes to garbage instead of throwing.
  // The parse below is what catches that, which is why one message has to
  // cover both encodings: at this point either could have been intended.
  const json = isProbablyBase64(text)
    ? Buffer.from(text, 'base64').toString('utf8')
    : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      'serviceAccountKeyJson is neither JSON nor base64-encoded JSON. It ' +
        'must hold the entire service account key file.'
    );
  }
  if (!isJsonObject(parsed) || !isCredentialObject(parsed)) {
    throw new Error(
      'serviceAccountKeyJson parsed but is not a service account key: it ' +
        'has no client_email and private_key. It must hold the entire key ' +
        'file, not a fragment of one.'
    );
  }
  return parsed;
}

// BigQuery label grammar: keys and values are lowercase, <=63 chars, and
// [a-z0-9_-]; keys must start with a lowercase letter. Values are transformed
// to fit (lowercase, disallowed chars -> '_', truncate); a key that can't be
// made valid (e.g. it starts with a digit) is dropped. BigQuery's 64-label cap
// needs no check here: the contract allows fewer properties than that.
const BQ_MAX_LEN = 63;

function sanitizeBigQueryValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, BQ_MAX_LEN);
}

function sanitizeBigQueryKey(key: string): string | undefined {
  const sanitized = sanitizeBigQueryValue(key);
  return /^[a-z]/.test(sanitized) ? sanitized : undefined;
}

/** Render a query's metadata as BigQuery job labels, in BQ's grammar. */
function toBigQueryLabels(
  labels: QueryMetadata | undefined
): Record<string, string> | undefined {
  if (labels === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    const sanitizedKey = sanitizeBigQueryKey(key);
    if (sanitizedKey === undefined) continue; // can't be a valid BQ key; drop
    out[sanitizedKey] = sanitizeBigQueryValue(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

interface SchemaInfo {
  schema: bigquery.ITableFieldSchema;
  needsTableSuffixPseudoColumn: boolean;
  needsPartitionTimePseudoColumn: boolean;
  needsPartitionDatePseudoColumn: boolean;
}

// BigQuery SDK apparently throws various authentication errors from Gaxios (https://github.com/googleapis/gaxios) and from
// @google-cloud/common (https://www.npmjs.com/package/@google-cloud/common)
// catching and rewriting here a single kind of authentication error we can consistently catch further up the stack
export class BigQueryAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigQueryAuthenticationError';
  }
}

const maybeRewriteError = (e: Error | unknown): Error => {
  // GaxiosError happens if credentials are revoked (for example, client.revokeCredentials()) or if
  // the refresh token is invalid
  // ApiErrors happen if token is revoked (for example, client.revokeToken(creds.access_token!))

  if (e instanceof Error) {
    if (
      (e instanceof GaxiosError && e.code === '400') ||
      (e instanceof googleCommon.ApiError && e.code === 401)
    ) {
      return new BigQueryAuthenticationError(e.message);
    } else return e;
  } else {
    // something throw a non-Error, and we didn't expect that
    throw e;
  }
};

/**
 * Default maximumBytesBilled value, 25GiB
 */
const MAXIMUM_BYTES_BILLED = String(25 * 1024 * 1024 * 1024);

/**
 * Default connection timeoutMs, 10 minutes. Bounds both the BigQuery job
 * (jobTimeoutMs) and, via getQueryResultsUntilComplete, how long results are
 * polled. When this connector runs behind an HTTP layer (e.g. the Malloy
 * Publisher), set the connection's timeoutMs below that layer's socket/request
 * timeout so a long query is ended by this deadline with a clear error, rather
 * than racing an opaque socket reset.
 */
const TIMEOUT_MS = 1000 * 60 * 10;

/**
 * How long each getQueryResults call asks to wait for the job to finish before
 * returning. BigQuery returns after at most ~200s regardless of the requested
 * value, so this is kept under that ceiling; queries that take longer are
 * covered by polling across multiple calls (see getQueryResultsUntilComplete).
 */
const GET_QUERY_RESULTS_POLL_MS = 1000 * 60 * 2;

/**
 * Minimum spacing between getQueryResults polls. Each call is asked to block
 * server-side for up to GET_QUERY_RESULTS_POLL_MS, but BigQuery may return
 * `jobComplete: false` sooner than requested; this floor keeps the loop from
 * busy-polling in that case. Only the shortfall below it is waited out, so a
 * poll that already blocked longer adds nothing.
 */
const GET_QUERY_RESULTS_MIN_POLL_INTERVAL_MS = 1000;

/** The result of a single getQueryResults poll. */
type PollOutcome =
  | {
      kind: 'complete';
      value: PagedResponse<
        RowMetadata,
        Query,
        bigquery.IGetQueryResultsResponse
      >;
    }
  | {kind: 'stillRunning'}
  | {kind: 'aborted'}
  | {kind: 'error'; error: unknown};

/**
 * Issue one getQueryResults call via the callback overload so we can read the
 * structured `jobComplete` flag rather than pattern-matching the client's error
 * string. On the still-running path the client invokes the callback with a
 * synthetic "did not complete before ..." Error *and* an apiResponse whose
 * `jobComplete === false`; we key off that boolean, which does not drift across
 * client releases the way the message can.
 *
 * `autoPaginate: false` is forced, not optional: getQueryResults is
 * paginator-wrapped, and at the default the paginator hands the callback the
 * error alone, dropping the apiResponse read here — so every still-running poll
 * would be misread as a fetch error. It does not change what a completed fetch
 * returns.
 *
 * Resolves promptly if `abortSignal` fires, so a caller's timeout/cancel is not
 * left blocked behind BigQuery's server-side wait.
 */
function pollQueryResults(
  job: Pick<Job, 'getQueryResults'>,
  options: QueryResultsOptions,
  abortSignal?: AbortSignal
): Promise<PollOutcome> {
  return new Promise<PollOutcome>(resolve => {
    let settled = false;
    const settle = (outcome: PollOutcome) => {
      if (settled) {
        return;
      }
      settled = true;
      abortSignal?.removeEventListener('abort', onAbort);
      resolve(outcome);
    };
    const onAbort = () => settle({kind: 'aborted'});
    if (abortSignal?.aborted) {
      settle({kind: 'aborted'});
      return;
    }
    abortSignal?.addEventListener('abort', onAbort);
    const pollOptions = {...options, autoPaginate: false};
    job.getQueryResults(pollOptions, (err, rows, nextQuery, apiResponse) => {
      if (apiResponse?.jobComplete === false) {
        settle({kind: 'stillRunning'});
      } else if (err) {
        settle({kind: 'error', error: err});
      } else {
        settle({
          kind: 'complete',
          value: [
            rows ?? [],
            nextQuery ?? null,
            apiResponse as bigquery.IGetQueryResultsResponse,
          ],
        });
      }
    });
  });
}

/** Cancel a job without letting a cancel failure mask the caller's real error. */
async function cancelJobQuietly(job: Pick<Job, 'cancel'>): Promise<void> {
  try {
    await job.cancel();
  } catch {
    // Best-effort: the job may already be finishing or gone; the caller still
    // reports the timeout that prompted the cancel.
  }
}

/**
 * A delay used to space out polls; resolves early if `abortSignal` fires, and is
 * injectable so tests need not wait real time.
 */
function delay(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (abortSignal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    abortSignal?.addEventListener('abort', onAbort, {once: true});
  });
}

/**
 * Fetch a job's query results, polling until the job completes, `deadlineMs`
 * elapses, or the caller aborts. A single getQueryResults call cannot wait out a
 * slow query: BigQuery bounds how long one call blocks server-side (its docs
 * note the call typically returns after ~200s even when a larger timeoutMs is
 * requested) and then reports `jobComplete: false` while the job is still
 * running normally. So for a query that runs longer than one call's server wait
 * we re-issue getQueryResults until it finishes.
 *
 * `deadlineMs` bounds the total wait (the connection's configured timeoutMs).
 * On reaching it we cancel the job before throwing: BigQuery's jobTimeoutMs
 * should already be cancelling it server-side, but if that timeout error has not
 * come back yet, cancelling here stops the job from running (and billing) past
 * the point we stopped waiting. `abortSignal` lets the loop exit promptly on an
 * external cancel (the caller cancels the job in that case). A bounded number of
 * retries absorbs the transient access-denied error BigQuery intermittently
 * returns on first fetch. Between polls a minimum interval is enforced so a poll
 * that returns sooner than requested does not spin the loop. `now` and `wait`
 * are injectable for testing.
 */
export async function getQueryResultsUntilComplete(
  job: Pick<Job, 'getQueryResults' | 'cancel'>,
  getQueryResultsOptions: QueryResultsOptions,
  deadlineMs: number,
  {
    abortSignal,
    now = Date.now,
    wait = delay,
  }: {
    abortSignal?: AbortSignal;
    now?: () => number;
    wait?: (ms: number, abortSignal?: AbortSignal) => Promise<void>;
  } = {}
): Promise<
  PagedResponse<RowMetadata, Query, bigquery.IGetQueryResultsResponse>
> {
  const startedAt = now();
  let transientRetries = 0;
  for (;;) {
    if (abortSignal?.aborted) {
      throw new Error(
        'BigQuery getQueryResults was aborted before the query completed.'
      );
    }
    const remainingMs = deadlineMs - (now() - startedAt);
    if (remainingMs <= 0) {
      await cancelJobQuietly(job);
      throw new Error(
        `BigQuery query did not complete within the configured timeout of ${deadlineMs}ms. ` +
          "Raise the connection's timeoutMs to allow longer-running queries."
      );
    }
    // Clamp the per-poll server wait to what's left of the deadline: a short
    // timeout then fails fast, and the overall deadline can't be overshot by a
    // full poll interval. timeoutMs is applied last so a caller-supplied
    // timeoutMs cannot override the poll interval.
    const pollTimeoutMs = Math.max(
      1,
      Math.min(GET_QUERY_RESULTS_POLL_MS, remainingMs)
    );
    const polledAt = now();
    const outcome = await pollQueryResults(
      job,
      {...getQueryResultsOptions, timeoutMs: pollTimeoutMs},
      abortSignal
    );
    switch (outcome.kind) {
      case 'complete':
        return outcome.value;
      case 'stillRunning': {
        // BigQuery can return `jobComplete: false` sooner than the timeoutMs we
        // asked for; without a floor between polls the loop would busy-poll and
        // hammer the API. Wait out only the shortfall below a minimum interval,
        // bounded by the remaining deadline, so a poll that already blocked adds
        // no latency. The abort/deadline checks at the top of the loop then
        // decide whether to continue, and a still-running poll never consumes
        // the transient-retry budget.
        const backoffMs = Math.min(
          GET_QUERY_RESULTS_MIN_POLL_INTERVAL_MS - (now() - polledAt),
          deadlineMs - (now() - startedAt)
        );
        if (backoffMs > 0) {
          await wait(backoffMs, abortSignal);
        }
        continue;
      }
      case 'aborted':
        throw new Error(
          'BigQuery getQueryResults was aborted before the query completed.'
        );
      case 'error':
        // A (possibly transient) fetch error — e.g. the intermittent
        // access-denied BigQuery returns on first fetch. Retry a bounded number
        // of times, then surface the real error.
        if (transientRetries++ < 3) {
          continue;
        }
        throw outcome.error;
    }
  }
}

// manage access to BQ, control costs, enforce global data/API limits
export class BigQueryConnection
  extends BaseConnection
  implements Connection, PersistSQLResults, StreamingConnection
{
  public readonly name: string;
  private readonly dialect = new StandardSQLDialect();
  static DEFAULT_QUERY_OPTIONS: RunSQLOptions = {
    rowLimit: 10,
  };

  private bigQuery: BigQuerySDK;
  private billingProjectId: string;
  private temporaryTables = new Map<string, string>();

  // This is the project we will use for table normalization. If someone
  // is querying a set of tables that is not in their billing project, this allows them to
  // not write the full path to the tables in every source
  private projectId;

  private queryOptions?: QueryOptionsReader;

  private config: BigQueryConnectionConfiguration;

  private location?: string;

  private setupSQL: string | undefined;

  private authIdentity: string | undefined;

  constructor(
    option: BigQueryConnectionOptions,
    queryOptions?: QueryOptionsReader
  );
  constructor(
    name: string,
    queryOptions?: QueryOptionsReader,
    config?: BigQueryConnectionConfiguration
  );
  constructor(
    arg: string | BigQueryConnectionOptions,
    queryOptions?: QueryOptionsReader,
    config: BigQueryConnectionConfiguration = {}
  ) {
    super();
    if (typeof arg === 'string') {
      this.name = arg;
    } else {
      // Every key-bearing property is destructured out of `args`, so a key
      // never lands in `this.config` — only the credentials object the SDK
      // needs does. `rawConfigData` comes out for the same reason: it is
      // read once, for the digest, and is not connection config.
      const {
        name,
        client_email,
        private_key,
        serviceAccountKey,
        serviceAccountKeyJson,
        rawConfigData,
        ...args
      } = arg;
      this.name = name;
      this.authIdentity = authIdentityOf(rawConfigData);
      config = args;
      // Trimmed before it is looked at: a value that came through a here-doc,
      // a `$(cat key.json)`, or a secret-store copy tends to carry a trailing
      // newline, and both the encoding sniff and the emptiness check below
      // would otherwise read it as content.
      const keyJson = serviceAccountKeyJson?.trim();
      if (serviceAccountKey) {
        config.credentials = serviceAccountKey;
      } else if (keyJson) {
        config.credentials = credentialsFromJson(keyJson);
      } else if (client_email || private_key) {
        config.credentials = {
          client_email,
          private_key,
        };
      }
    }
    rejectCompetingCredentials(this.name, config);
    this.bigQuery = new BigQuerySDK({
      userAgent: `Malloy/${Malloy.version}`,
      keyFilename: config.serviceAccountKeyPath,
      credentials: config.credentials,
      authClient: config.authClient,
      projectId: config.billingProjectId,
    });

    // record project ID because for unclear reasons we have to modify the project ID on the SDK when
    // we want to use the tables API
    this.billingProjectId = this.bigQuery.projectId;
    this.projectId = config.projectId || this.bigQuery.projectId;

    this.queryOptions = queryOptions;
    this.config = config;
    this.location = config.location;
    this.setupSQL = config.setupSQL;
  }

  get dialectName(): string {
    return 'standardsql';
  }

  private prependSetupSQL(sql: string): string {
    if (!this.setupSQL) return sql;
    const setup = this.setupSQL.trimEnd().endsWith(';')
      ? this.setupSQL
      : this.setupSQL + ';';
    return setup + '\n' + sql;
  }

  private readQueryOptions(): RunSQLOptions {
    const options = BigQueryConnection.DEFAULT_QUERY_OPTIONS;
    if (this.queryOptions) {
      if (this.queryOptions instanceof Function) {
        return {...options, ...this.queryOptions()};
      } else {
        return {...options, ...this.queryOptions};
      }
    } else {
      return options;
    }
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public getDigest(): string {
    // Appended only when an auth client is in play, so connections that don't
    // use one keep the digests — and so the persisted tables — they have now.
    return this.authIdentity === undefined
      ? makeDigest('bigquery', this.projectId, this.setupSQL)
      : makeDigest(
          'bigquery',
          this.projectId,
          this.setupSQL,
          this.authIdentity
        );
  }

  public get supportsNesting(): boolean {
    return true;
  }

  private async _runSQL(
    sqlCommand: string,
    options: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<{
    data: MalloyQueryData;
    schema: bigquery.ITableFieldSchema | undefined;
  }> {
    const {rowLimit, abortSignal} = options;
    const defaultOptions = this.readQueryOptions();
    const pageSize = rowLimit ?? defaultOptions.rowLimit;
    const perCallLabels = toBigQueryLabels(
      this.queryMetadataBag(options.queryMetadata)
    );

    try {
      const queryResultsOptions: QueryResultsOptions = {
        maxResults: pageSize,
        startIndex: rowIndex.toString(),
      };

      const jobResult = await this.createBigQueryJobAndGetResults(
        sqlCommand,
        perCallLabels ? {labels: perCallLabels} : undefined,
        queryResultsOptions,
        abortSignal
      );

      const totalRows = +(jobResult[2]?.totalRows
        ? jobResult[2].totalRows
        : '0');

      // jobComplete is guaranteed here: getQueryResultsUntilComplete only
      // returns once BigQuery reports the job complete (it polls otherwise).
      const queryCostBytes = jobResult[2]?.totalBytesProcessed;
      const data: MalloyQueryData = {
        rows: jobResult[0],
        totalRows,
        runStats: {
          queryCostBytes: queryCostBytes ? +queryCostBytes : undefined,
        },
      };
      const schema = jobResult[2]?.schema;

      return {data, schema};
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  public async runSQL(
    sqlCommand: string,
    options: RunSQLOptions = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const {data} = await this._runSQL(sqlCommand, options, rowIndex);
    return data;
  }

  public async runSQLBlockAndFetchResultSchema(
    sqlBlock: SQLSourceDef,
    options?: RunSQLOptions
  ): Promise<{data: MalloyQueryData; schema: SQLSourceDef}> {
    const {data, schema: schemaRaw} = await this._runSQL(
      sqlBlock.selectStr,
      options
    );

    // TODO need to probably surface the cause of the schema not present error
    if (schemaRaw === undefined) {
      throw new Error('Schema not present');
    }

    const schema: SQLSourceDef = {...sqlBlock, fields: []};
    this.addFieldsToStructDef(schema, schemaRaw);
    return {data, schema};
  }

  public async downloadMalloyQuery(
    sqlCommand: string
  ): Promise<ResourceStream<RowMetadata>> {
    const job = await this.createBigQueryJob({
      query: sqlCommand,
    });

    return job.getQueryResultsStream();
  }

  private async dryRunSQLQuery(sqlCommand: string): Promise<Job> {
    try {
      const [result] = await this.bigQuery.createQueryJob({
        location: this.location,
        query: this.prependSetupSQL(sqlCommand),
        dryRun: true,
      });
      return result;
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  public async estimateQueryCost(sqlCommand: string): Promise<QueryRunStats> {
    const dryRunResults = await this.dryRunSQLQuery(sqlCommand);
    return {
      queryCostBytes: Number(
        dryRunResults.metadata.statistics.totalBytesProcessed
      ),
    };
  }

  private decodeTablePath(tablePath: string) {
    return decodeDottedTablePath(tablePath, {
      quoteChar: '`',
      escapeStyle: 'backslash',
      bareIdentRegex: this.dialect.tablePathBareIdentRegex,
      dialectName: 'BigQuery',
    });
  }

  // The whole-backtick form `` `proj.dataset.table` `` parses as one
  // quoted segment, but the metadata API still wants the parts
  // separately — split its decoded body on `.` to recover them.
  private decodeTablePathSegments(tablePath: string): string[] {
    const result = this.decodeTablePath(tablePath);
    if (!result.ok) return [tablePath];
    if (result.segments.length === 1 && result.segments[0].quoted) {
      return result.segments[0].value.split('.');
    }
    return result.segments.map(s => s.value);
  }

  public async getTableFieldSchema(tablePath: string): Promise<SchemaInfo> {
    let segments = this.decodeTablePathSegments(tablePath);
    if (segments.length === 2) {
      segments = [this.projectId, ...segments];
    }
    if (segments.length !== 3) {
      throw new Error(
        `Improper table path: ${tablePath}. A table path requires 2 or 3 segments`
      );
    }
    const [projectId, datasetNamePart, tableNamePart] = segments;

    try {
      // TODO The `dataset` API has no way to set a different `projectId` than the one stored in the BQ
      //      instance. So we hack it until a better way exists: we set the `this.bigQuery.projectId`
      //      to the `projectId` for the dataset, then put it back when we're done. Importantly, we
      //      set it back _before_ we await the promise, thus avoiding a "concurrency" issue. We've decided
      //      this is better than creating a new BQ instance every time we need to get a table schema.
      if (projectId) this.bigQuery.projectId = projectId;
      const needTableSuffixPseudoColumn =
        tableNamePart !== undefined &&
        tableNamePart[tableNamePart.length - 1] === '*';
      const table = this.bigQuery.dataset(datasetNamePart).table(tableNamePart);
      const metadataPromise = table.getMetadata();
      this.bigQuery.projectId = this.billingProjectId;
      const [metadata] = await metadataPromise;
      return {
        schema: metadata.schema,
        needsTableSuffixPseudoColumn: needTableSuffixPseudoColumn,
        needsPartitionTimePseudoColumn:
          metadata.timePartitioning?.type !== undefined &&
          metadata.timePartitioning?.field === undefined,
        needsPartitionDatePseudoColumn:
          metadata.timePartitioning?.type !== undefined &&
          metadata.timePartitioning?.field === undefined &&
          metadata.timePartitioning!.type === 'DAY',
      };
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  public async executeSQLRaw(sqlCommand: string): Promise<QueryData> {
    const result = await this.createBigQueryJobAndGetResults(sqlCommand);
    return result[0];
  }

  public async test(): Promise<void> {
    await this.dryRunSQLQuery('SELECT 1');
  }

  /*
   *   Do we need to care about multiple overlapping calls to this function? No.
   *
   *   If two long-running jobs using the exact same SQL are started by the same user and overlap - meaning, there is
   *   a job running with some SQL, and while it is PENDING or RUNNING, another job with the same SQL is added -
   *   the ultimate destination table for those jobs is the same table, if the source table(s) haven't changed, and
   *   SQL didn't use some mutable functions.
   *
   *   If second job goes to RUNNING after first job finished, it will just reuse its results (this is the caching
   *   behavior). But if both of them are RUNNING at the same time, they will both do the work and consume the slots.
   *   If they finish around same time, the second job discards its results. If second job finishes much later than
   *   the first one (like an hour or so), it will update this destination table to extend its TTL
   *
   *   This means that longer-term, we may want to block multiple calls at the app level (if tons of dashboards were
   *   hitting this, creating many instances of the same table run, that might start to cost $$) but for now we're
   *   ok with this simple approach
   *
   */
  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = makeDigest(sqlCommand);

    const tempTableName: string | undefined = this.temporaryTables.get(hash);
    if (tempTableName !== undefined) {
      return tempTableName;
    } else {
      try {
        const [job] = await this.bigQuery.createQueryJob({
          location: this.location,
          query: sqlCommand,
        });

        let [metaData] = await job.getMetadata();

        // wait for job to complete, because we need the table name
        // TODO just because a job is "DONE" doesn't mean it ended correctly, should probably also confirm
        // status is successful & that table was created
        // TODO this needs better error handling and a timeout so that issues dont result in infinite looping
        while (metaData.status.state !== 'DONE') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          [metaData] = await job.getMetadata();
        }

        // save table name
        if (
          metaData.configuration &&
          metaData.configuration.query &&
          metaData.configuration.query.destinationTable
        ) {
          const destinationTable =
            metaData.configuration.query.destinationTable;
          const fullTableName = `${destinationTable.projectId}.${destinationTable.datasetId}.${destinationTable.tableId}`;
          this.temporaryTables.set(hash, fullTableName);
          return fullTableName;
        } else {
          throw new Error(
            'bigquery.job.getMetadata() - metadata should have configuration but does not'
          );
        }
      } catch (e) {
        throw maybeRewriteError(e);
      }
    }
  }

  // TODO there is reasonable argument that this has nothing to do with Malloy, and should be implemented
  // by whatever library is using Malloy.
  public async manifestPermanentTable(
    sqlCommand: string,
    datasetName: string,
    tableName: string,
    overwriteExistingTable = false,
    createDataset = false
  ): Promise<string> {
    let dataset = this.bigQuery.dataset(datasetName);

    if (!(await dataset.exists())[0]) {
      if (createDataset) {
        const newDatasetResponse =
          await this.bigQuery.createDataset(datasetName);
        dataset = newDatasetResponse[0];
      } else {
        throw new Error(`Dataset ${datasetName} does not exist`);
      }
    }

    const table = dataset.table(tableName);

    if ((await table.exists())[0] && !overwriteExistingTable) {
      throw new Error(`Table ${tableName} already exists`);
    }

    const [job] = await this.bigQuery.createQueryJob({
      query: this.prependSetupSQL(sqlCommand),
      location: this.location,
      destination: table,
    });

    // if creating this job didn't throw, there's an ID.

    return job.id!;
  }

  private addFieldsToStructDef(
    structDef: StructDef,
    tableFieldSchema: bigquery.ITableFieldSchema
  ): void {
    if (!tableFieldSchema.fields) return;
    for (const field of tableFieldSchema.fields) {
      // BigQuery SDK sets type & name to optional even though they are required, assume they exist
      const type = field.type as string;
      const name = field.name as string;

      const isRecord = ['STRUCT', 'RECORD'].includes(type);
      const structShared = {name, dialect: this.dialectName, fields: []};
      if (field.mode === 'REPEATED' && !isRecord) {
        // Malloy treats repeated values as an array of scalars.
        const malloyType = this.dialect.sqlTypeToMalloyType(type);
        if (malloyType) {
          structDef.fields.push(mkArrayDef(malloyType, name));
        }
      } else if (isRecord) {
        const ifRepeatedRecord: StructDef = {
          ...structShared,
          type: 'array',
          elementTypeDef: {type: 'record_element'},
          join: 'many',
        };
        const elseRecord: StructDef = {
          ...structShared,
          type: 'record',
          join: 'one',
        };
        const recStruct =
          field.mode === 'REPEATED' ? ifRepeatedRecord : elseRecord;
        this.addFieldsToStructDef(recStruct, field);
        structDef.fields.push(recStruct);
      } else {
        const malloyType = this.dialect.sqlTypeToMalloyType(type) ?? {
          type: 'sql native',
          rawType: type.toLowerCase(),
        };
        structDef.fields.push({name, ...malloyType});
      }
    }
  }

  async fetchSelectSchema(
    sqlSource: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    try {
      const ret: SQLSourceDef = {
        type: 'sql_select',
        ...sqlSource,
        dialect: this.dialectName,
        fields: [],
        name: sqlKey(sqlSource.connection, sqlSource.selectStr),
      };
      this.addFieldsToStructDef(ret, await this.getSQLBlockSchema(ret));
      return ret;
    } catch (error) {
      return error.message;
    }
  }

  // tablePath is pasted into the FROM clause verbatim — we never edit the
  // characters the user wrote. The default project is the one sanctioned
  // addition: BigQuery resolves an unqualified `dataset.table` against the
  // job's billing/ambient project, so when the user omits the project we
  // prepend it as a new leading segment. We do this exactly when the user
  // wrote a two-segment path; anything else (a single segment, an already-
  // qualified path, or a path wrapped entirely in backticks — which decodes
  // to one segment) is left as written, and the user supplies the project.
  // The project is the one segment we render ourselves, so we quote it if
  // BigQuery requires it (e.g. a legacy `domain.com:project` id).
  private qualifyTablePath(tablePath: string): string {
    const decoded = this.decodeTablePath(tablePath);
    if (!decoded.ok || decoded.segments.length !== 2) {
      return tablePath;
    }
    return `${this.encodeProjectSegment(this.projectId)}.${tablePath}`;
  }

  private encodeProjectSegment(project: string): string {
    // Leave it bare only if the whole id is a bare table-path segment (the
    // regex anchors the start, so require it to match end to end); otherwise
    // quote it the way BigQuery would any other identifier.
    const bare = this.dialect.tablePathBareIdentRegex.exec(project);
    if (bare && bare[0] === project) {
      return project;
    }
    return this.dialect.sqlQuoteIdentifier(project);
  }

  async fetchTableSchema(
    tableName: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    try {
      const tableFieldSchema = await this.getTableFieldSchema(tablePath);
      const tableDef: TableSourceDef = {
        type: 'table',
        name: tableName,
        dialect: this.dialectName,
        tablePath: this.qualifyTablePath(tablePath),
        connection: this.name,
        fields: [],
      };
      this.addFieldsToStructDef(tableDef, tableFieldSchema.schema);
      if (tableFieldSchema.needsTableSuffixPseudoColumn) {
        tableDef.fields.push({
          type: 'string',
          name: '_TABLE_SUFFIX',
        });
      }
      if (tableFieldSchema.needsPartitionTimePseudoColumn) {
        tableDef.fields.push({
          type: 'timestamp',
          name: '_PARTITIONTIME',
        });
      }
      if (tableFieldSchema.needsPartitionDatePseudoColumn) {
        tableDef.fields.push({
          type: 'date',
          name: '_PARTITIONDATE',
        });
      }
      return tableDef;
    } catch (error) {
      return error.message;
    }
  }

  private async getSQLBlockSchema(sqlRef: SQLSourceDef) {
    // We do a simple retry-loop here, as a temporary fix for a transient
    // error in which sometimes requesting results from a job yields an
    // access denied error. It seems that in these cases, simply trying again
    // solves the problem. This is being currently investigated by
    // @christopherswenson and @lloydtabb. Same as below.
    let lastFetchError;
    for (let retries = 0; retries < 3; retries++) {
      try {
        const [job] = await this.bigQuery.createQueryJob({
          location: this.location,
          query: this.prependSetupSQL(sqlRef.selectStr),
          dryRun: true,
        });

        return job.metadata.statistics.query.schema;
      } catch (fetchError) {
        lastFetchError = fetchError;
      }
    }
    throw lastFetchError;
  }

  /**
   * The effective query timeout in milliseconds. A configured value that is
   * unset, blank, non-numeric, zero, or negative falls back to TIMEOUT_MS; only
   * a positive number overrides the default. The result bounds both the
   * BigQuery job (jobTimeoutMs) and the getQueryResultsUntilComplete poll
   * deadline, so it must be positive: a zero or negative would make the job
   * cancel on the first poll instead of running.
   */
  private resolvedTimeoutMs(): number {
    const configured = Number(this.config.timeoutMs);
    return configured > 0 ? configured : TIMEOUT_MS;
  }

  private async createBigQueryJobAndGetResults(
    sqlCommand: string,
    createQueryJobOptions?: Query,
    getQueryResultsOptions?: QueryResultsOptions,
    abortSignal?: AbortSignal
  ): Promise<
    PagedResponse<RowMetadata, Query, bigquery.IGetQueryResultsResponse>
  > {
    try {
      const job = await this.createBigQueryJob({
        query: sqlCommand,
        ...createQueryJobOptions,
      });
      const cancel = () => {
        job.cancel();
      };
      abortSignal?.addEventListener('abort', cancel);

      try {
        // Poll for results until the job completes or the connection's
        // configured timeout elapses; a single getQueryResults call can't wait
        // out a long-running query (see getQueryResultsUntilComplete). The
        // deadline is the same resolved timeout that bounds the job's
        // jobTimeoutMs, so the client stops waiting right about when BigQuery
        // stops running the job.
        return await getQueryResultsUntilComplete(
          job,
          {
            wrapIntegers: {
              integerTypeCastFunction: (val: string | number) => {
                const num = Number(val);
                if (Number.isSafeInteger(num)) {
                  return num;
                }
                return String(val);
              },
            },
            ...getQueryResultsOptions,
          },
          this.resolvedTimeoutMs(),
          {abortSignal}
        );
      } finally {
        abortSignal?.removeEventListener('abort', cancel);
      }
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  private async createBigQueryJob(createQueryJobOptions?: Query): Promise<Job> {
    const options = {...createQueryJobOptions};
    if (options.query) {
      options.query = this.prependSetupSQL(options.query);
    }
    const [job] = await this.bigQuery.createQueryJob({
      location: this.location,
      maximumBytesBilled:
        this.config.maximumBytesBilled || MAXIMUM_BYTES_BILLED,
      // Shadow the resolved timeout to the job's server-side limit so BigQuery
      // cancels a runaway job on its own; getQueryResultsUntilComplete polls up
      // to the same deadline on the client side.
      jobTimeoutMs: this.resolvedTimeoutMs(),
      ...options,
    });
    return job;
  }

  public async initiateJobAndGetLinkToConsole(
    sqlCommand: string,
    dryRun = false
  ): Promise<string> {
    const job = await this.createBigQueryJob({
      query: sqlCommand,
      dryRun,
    });
    const url = `https://console.cloud.google.com/bigquery?project=${this.billingProjectId}&j=bq:${job.location}:${job.id}&page=queryresults`;
    return url;
  }

  public runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal, queryMetadata}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryRecord> {
    const labels = toBigQueryLabels(this.queryMetadataBag(queryMetadata));
    const streamBigQuery = (
      onError: (error: Error) => void,
      onData: (data: QueryRecord) => void,
      onEnd: () => void
    ) => {
      let index = 0;
      function handleData(
        this: ResourceStream<RowMetadata>,
        rowMetadata: RowMetadata
      ) {
        onData(rowMetadata);
        index += 1;
        if (
          (rowLimit !== undefined && index >= rowLimit) ||
          abortSignal?.aborted
        ) {
          this.end();
        }
      }
      const query = this.prependSetupSQL(sqlCommand);
      this.bigQuery
        .createQueryStream(labels ? {query, labels} : query)
        .on('error', onError)
        .on('data', handleData)
        .on('end', onEnd);
    };
    return toAsyncGenerator<QueryRecord>(streamBigQuery);
  }

  async fetchTableMetadata(tablePath: string): Promise<TableMetadata> {
    const [proj, dataset, table] = this.decodeTablePathSegments(tablePath);
    return {
      url: `https://console.cloud.google.com/bigquery?ws=!1m5!1m4!4m3!1s${proj}!2s${dataset}!3s${table}`,
    };
  }

  async close(): Promise<void> {
    return;
  }
}
