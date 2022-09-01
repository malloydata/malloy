/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import * as crypto from "crypto";
import {
  BigQuery as BigQuerySDK,
  Job,
  PagedResponse,
  Query,
  QueryResultsOptions,
  RowMetadata,
} from "@google-cloud/bigquery";
import bigquery from "@google-cloud/bigquery/build/src/types";
import { ResourceStream } from "@google-cloud/paginator";
import * as googleCommon from "@google-cloud/common";
import { GaxiosError } from "gaxios";
import {
  Malloy,
  QueryData,
  StructDef,
  MalloyQueryData,
  FieldTypeDef,
  NamedStructDefs,
  SQLBlock,
  Connection,
  QueryDataRow,
  toAsyncGenerator,
} from "@malloydata/malloy";
import { parseTableURL } from "@malloydata/malloy";
import { PooledConnection } from "@malloydata/malloy";
import {
  FetchSchemaAndRunSimultaneously,
  FetchSchemaAndRunStreamSimultaneously,
  PersistSQLResults,
  StreamingConnection,
} from "@malloydata/malloy/src/runtime_types";

export interface BigQueryManagerOptions {
  credentials?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string | null;
  };
  projectId?: string | undefined;
  userAgent: string;
}

export interface BigQueryQueryOptions {
  rowLimit: number;
}

interface BigQueryConnectionConfiguration {
  defaultProject?: string;
  serviceAccountKeyPath?: string;
  location?: string;
  maximumBytesBilled?: string;
  timeoutMs?: string;
}

interface SchemaInfo {
  schema: bigquery.ITableFieldSchema;
  needsPartitionPsuedoColumn: boolean;
}

type QueryOptionsReader =
  | Partial<BigQueryQueryOptions>
  | (() => Partial<BigQueryQueryOptions>);

// BigQuery SDK apparently throws various authentication errors from Gaxios (https://github.com/googleapis/gaxios) and from
// @google-cloud/common (https://www.npmjs.com/package/@google-cloud/common)
// catching and rewriting here a single kind of authentication error we can consistently catch further up the stack
export class BigQueryAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BigQueryAuthenticationError";
  }
}

const maybeRewriteError = (e: Error | unknown): Error => {
  // GaxiosError happens if credentials are revoked (for example, client.revokeCredentials()) or if
  // the refresh token is invalid
  // ApiErrors happen if token is revoked (for example, client.revokeToken(creds.access_token!))

  if (e instanceof Error) {
    if (
      (e instanceof GaxiosError && e.code === "400") ||
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
 * Default timeoutMs value, 10 Mins
 */
const TIMEOUT_MS = 1000 * 60 * 10;

// manage access to BQ, control costs, enforce global data/API limits
export class BigQueryConnection
  implements
    Connection,
    PersistSQLResults,
    StreamingConnection,
    FetchSchemaAndRunSimultaneously
{
  static DEFAULT_QUERY_OPTIONS: BigQueryQueryOptions = {
    rowLimit: 10,
  };

  private bigQuery: BigQuerySDK;
  private projectId;
  private temporaryTables = new Map<string, string>();
  private defaultProject;

  private schemaCache = new Map<
    string,
    | { schema: StructDef; error?: undefined }
    | { error: string; schema?: undefined }
  >();
  private sqlSchemaCache = new Map<
    string,
    | { schema: StructDef; error?: undefined }
    | { error: string; schema?: undefined }
  >();

  private queryOptions?: QueryOptionsReader;

  private config: BigQueryConnectionConfiguration;

  private location: string;

  public readonly name: string;

  bqToMalloyTypes: { [key: string]: Partial<FieldTypeDef> } = {
    DATE: { type: "date" },
    STRING: { type: "string" },
    INTEGER: { type: "number", numberType: "integer" },
    INT64: { type: "number", numberType: "integer" },
    FLOAT: { type: "number", numberType: "float" },
    FLOAT64: { type: "number", numberType: "float" },
    NUMERIC: { type: "number", numberType: "float" },
    BIGNUMERIC: { type: "number", numberType: "float" },
    TIMESTAMP: { type: "timestamp" },
    BOOLEAN: { type: "boolean" },
    BOOL: { type: "boolean" },
    // TODO (https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema):
    // BYTES
    // DATETIME
    // TIME
    // GEOGRAPHY
  };

  constructor(
    name: string,
    queryOptions?: QueryOptionsReader,
    config: BigQueryConnectionConfiguration = {}
  ) {
    this.name = name;
    this.bigQuery = new BigQuerySDK({
      userAgent: `Malloy/${Malloy.version}`,
      keyFilename: config.serviceAccountKeyPath,
    });

    // record project ID because for unclear reasons we have to modify the project ID on the SDK when
    // we want to use the tables API
    this.projectId = this.bigQuery.projectId;
    this.defaultProject = config.defaultProject || this.bigQuery.projectId;

    this.queryOptions = queryOptions;
    this.config = config;
    this.location = config.location || "US";
  }

  get dialectName(): string {
    return "standardsql";
  }

  private readQueryOptions(): BigQueryQueryOptions {
    const options = BigQueryConnection.DEFAULT_QUERY_OPTIONS;
    if (this.queryOptions) {
      if (this.queryOptions instanceof Function) {
        return { ...options, ...this.queryOptions() };
      } else {
        return { ...options, ...this.queryOptions };
      }
    } else {
      return options;
    }
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public canFetchSchemaAndRunSimultaneously(): this is FetchSchemaAndRunSimultaneously {
    return true;
  }

  public canFetchSchemaAndRunStreamSimultaneously(): this is FetchSchemaAndRunStreamSimultaneously {
    return false;
  }

  private async _runSQL(
    sqlCommand: string,
    options: Partial<BigQueryQueryOptions> = {},
    rowIndex = 0
  ): Promise<{ data: MalloyQueryData; schema: bigquery.ITableFieldSchema }> {
    const defaultOptions = this.readQueryOptions();
    const pageSize = options.rowLimit ?? defaultOptions.rowLimit;

    try {
      const queryResultsOptions = {
        maxResults: pageSize,
        startIndex: rowIndex.toString(),
      };

      const jobResult = await this.createBigQueryJobAndGetResults(
        sqlCommand,
        undefined,
        queryResultsOptions
      );

      const totalRows = +(jobResult[2]?.totalRows
        ? jobResult[2].totalRows
        : "0");

      // TODO need to probably surface the cause of the schema not present error
      if (jobResult[2]?.schema === undefined) {
        throw new Error("Schema not present");
      }

      // TODO even though we have 10 minute timeout limit, we still should confirm that resulting metadata has "jobComplete: true"
      const data = { rows: jobResult[0], totalRows };
      const schema = jobResult[2]?.schema;

      return { data, schema };
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  public async runSQL(
    sqlCommand: string,
    options: Partial<BigQueryQueryOptions> = {},
    rowIndex = 0
  ): Promise<MalloyQueryData> {
    const { data } = await this._runSQL(sqlCommand, options, rowIndex);
    return data;
  }

  public async runSQLBlockAndFetchResultSchema(
    sqlBlock: SQLBlock,
    options?: { rowLimit?: number | undefined }
  ): Promise<{ data: MalloyQueryData; schema: StructDef }> {
    const { data, schema: schemaRaw } = await this._runSQL(
      sqlBlock.select,
      options
    );
    const schema = this.structDefFromSQLSchema(sqlBlock, schemaRaw);
    return { data, schema };
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
        query: sqlCommand,
        dryRun: true,
      });
      return result;
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  public async costQuery(sqlCommand: string): Promise<number> {
    const dryRunResults = await this.dryRunSQLQuery(sqlCommand);
    return Number(dryRunResults.metadata.statistics.totalBytesProcessed);
  }

  public async structDefFromSQL(sqlCommand: string): Promise<StructDef> {
    const dryRunResults = await this.dryRunSQLQuery(sqlCommand);
    const destinationTable =
      dryRunResults.metadata.configuration.query.destinationTable;

    return this.structDefFromTableSchema(
      `${destinationTable.projectId}.${destinationTable.datasetId}.${destinationTable.tableId}`,
      dryRunResults.metadata.statistics.query.schema
    );
  }

  public async getTableFieldSchema(tableURL: string): Promise<SchemaInfo> {
    const { tablePath: tableName } = parseTableURL(tableURL);
    const segments = tableName.split(".");

    // paths can have two or three segments
    // if there are only two segments, assume the dataset is "local" to the current billing project
    let projectId, datasetNamePart, tableNamePart;
    if (segments.length === 2) {
      [datasetNamePart, tableNamePart] = segments;
      projectId = this.defaultProject;
    } else if (segments.length === 3)
      [projectId, datasetNamePart, tableNamePart] = segments;
    else
      throw new Error(
        `Improper table path: ${tableName}. A table path requires 2 or 3 segments`
      );

    try {
      // TODO The `dataset` API has no way to set a different `projectId` than the one stored in the BQ
      //      instance. So we hack it until a better way exists: we set the `this.bigQuery.projectId`
      //      to the `projectId` for the dataset, then put it back when we're done. Importantly, we
      //      set it back _before_ we await the promise, thus avoiding a "concurrency" issue. We've decided
      //      this is better than creating a new BQ instance every time we need to get a table schema.
      if (projectId) this.bigQuery.projectId = projectId;
      const table = this.bigQuery.dataset(datasetNamePart).table(tableNamePart);
      const metadataPromise = table.getMetadata();
      this.bigQuery.projectId = this.projectId;
      const [metadata] = await metadataPromise;
      return {
        schema: metadata.schema,
        needsPartitionPsuedoColumn:
          metadata.timePartitioning?.type !== undefined &&
          metadata.timePartitioning?.field === undefined,
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
    await this.dryRunSQLQuery("SELECT 1");
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
    const hash = crypto.createHash("md5").update(sqlCommand).digest("hex");

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
        while (metaData.status.state !== "DONE") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
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
            "bigquery.job.getMetadata() - metadata should have configuration but does not"
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
        const newDatasetResponse = await this.bigQuery.createDataset(
          datasetName
        );
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
      query: sqlCommand,
      location: this.location,
      destination: table,
    });

    // if creating this job didn't throw, there's an ID.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

      // check for an array
      if (field.mode === "REPEATED" && !["STRUCT", "RECORD"].includes(type)) {
        const malloyType = this.bqToMalloyTypes[type];
        if (malloyType) {
          const innerStructDef: StructDef = {
            type: "struct",
            name,
            dialect: this.dialectName,
            structSource: { type: "nested" },
            structRelationship: { type: "nested", field: name, isArray: true },
            fields: [{ ...malloyType, name: "value" } as FieldTypeDef],
          };
          structDef.fields.push(innerStructDef);
        }
      } else if (["STRUCT", "RECORD"].includes(type)) {
        const innerStructDef: StructDef = {
          type: "struct",
          name,
          dialect: this.dialectName,
          structSource:
            field.mode === "REPEATED" ? { type: "nested" } : { type: "inline" },
          structRelationship:
            field.mode === "REPEATED"
              ? { type: "nested", field: name, isArray: false }
              : { type: "inline" },
          fields: [],
        };
        this.addFieldsToStructDef(innerStructDef, field);
        structDef.fields.push(innerStructDef);
      } else {
        const malloyType = this.bqToMalloyTypes[type];
        if (malloyType) {
          structDef.fields.push({ name, ...malloyType } as FieldTypeDef);
        } else {
          structDef.fields.push({
            name,
            type: "string",
            e: [`BigQuery type "${type}" not supported by Malloy`],
          });
        }
      }
    }
  }

  private tableURLtoTablePath(tableURL: string): string {
    const { tablePath } = parseTableURL(tableURL);
    if (tablePath.split(".").length === 2) {
      return `${this.defaultProject}.${tablePath}`;
    } else {
      return tablePath;
    }
  }

  private structDefFromTableSchema(
    tableURL: string,
    schemaInfo: SchemaInfo
  ): StructDef {
    const structDef: StructDef = {
      type: "struct",
      name: tableURL,
      dialect: this.dialectName,
      structSource: {
        type: "table",
        tablePath: this.tableURLtoTablePath(tableURL),
      },
      structRelationship: { type: "basetable", connectionName: this.name },
      fields: [],
    };
    this.addFieldsToStructDef(structDef, schemaInfo.schema);
    if (schemaInfo.needsPartitionPsuedoColumn) {
      structDef.fields.push({
        type: "timestamp",
        name: "_PARTITIONTIME",
      });
    }
    return structDef;
  }

  private structDefFromSQLSchema(
    sqlBlock: SQLBlock,
    tableFieldSchema: bigquery.ITableFieldSchema
  ): StructDef {
    const structDef: StructDef = {
      type: "struct",
      name: sqlBlock.name,
      dialect: this.dialectName,
      structSource: {
        type: "sql",
        method: "subquery",
        sqlBlock,
      },
      structRelationship: { type: "basetable", connectionName: this.name },
      fields: [],
    };
    this.addFieldsToStructDef(structDef, tableFieldSchema);
    return structDef;
  }

  public async fetchSchemaForTables(missing: string[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: { [name: string]: string } = {};

    for (const tableURL of missing) {
      let inCache = this.schemaCache.get(tableURL);
      if (!inCache) {
        try {
          const tableFieldSchema = await this.getTableFieldSchema(tableURL);
          inCache = {
            schema: this.structDefFromTableSchema(tableURL, tableFieldSchema),
          };
          this.schemaCache.set(tableURL, inCache);
        } catch (error) {
          inCache = { error: error.message };
        }
      }
      if (inCache.schema !== undefined) {
        schemas[tableURL] = inCache.schema;
      } else {
        errors[tableURL] = inCache.error;
      }
    }
    return { schemas, errors };
  }

  private async getSQLBlockSchema(sqlRef: SQLBlock) {
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
          query: sqlRef.select,
          dryRun: true,
        });

        return job.metadata.statistics.query.schema;
      } catch (fetchError) {
        lastFetchError = fetchError;
      }
    }
    throw lastFetchError;
  }

  public async fetchSchemaForSQLBlocks(sqlRefs: SQLBlock[]): Promise<{
    schemas: Record<string, StructDef>;
    errors: Record<string, string>;
  }> {
    const schemas: NamedStructDefs = {};
    const errors: { [name: string]: string } = {};

    for (const sqlRef of sqlRefs) {
      const key = sqlRef.name;
      let inCache = this.sqlSchemaCache.get(key);
      if (!inCache) {
        try {
          const tableFieldSchema = await this.getSQLBlockSchema(sqlRef);
          inCache = {
            schema: this.structDefFromSQLSchema(sqlRef, tableFieldSchema),
          };
          this.schemaCache.set(key, inCache);
        } catch (error) {
          inCache = { error: error.message };
        }
      }
      if (inCache.schema !== undefined) {
        schemas[key] = inCache.schema;
      } else {
        errors[key] = inCache.error;
      }
    }
    return { schemas, errors };
  }

  // TODO this needs to extend the wait for results using a timeout set by the user,
  // and probably needs to loop to check for results - BQ docs now say that after ~2min of waiting,
  // no matter what you set for timeoutMs, they will probably just return.
  private async createBigQueryJobAndGetResults(
    sqlCommand: string,
    createQueryJobOptions?: Query,
    getQueryResultsOptions?: QueryResultsOptions
  ): Promise<
    PagedResponse<RowMetadata, Query, bigquery.IGetQueryResultsResponse>
  > {
    try {
      const job = await this.createBigQueryJob({
        query: sqlCommand,
        ...createQueryJobOptions,
      });

      // TODO we should check if this is still required?
      // We do a simple retry-loop here, as a temporary fix for a transient
      // error in which sometimes requesting results from a job yields an
      // access denied error. It seems that in these cases, simply trying again
      // solves the problem. This is being currently investigated by
      // @christopherswenson and @lloydtabb.
      let lastFetchError;
      for (let retries = 0; retries < 3; retries++) {
        try {
          return await job.getQueryResults({
            timeoutMs: 1000 * 60 * 2, // TODO - this requires some rethinking, and is a hack to resolve some issues. talk to @bporterfield
            ...getQueryResultsOptions,
          });
        } catch (fetchError) {
          lastFetchError = fetchError;
        }
      }

      throw lastFetchError;
    } catch (e) {
      throw maybeRewriteError(e);
    }
  }

  private async createBigQueryJob(createQueryJobOptions?: Query): Promise<Job> {
    const [job] = await this.bigQuery.createQueryJob({
      location: this.location,
      maximumBytesBilled:
        this.config.maximumBytesBilled || MAXIMUM_BYTES_BILLED,
      jobTimeoutMs: Number(this.config.timeoutMs) || TIMEOUT_MS,
      ...createQueryJobOptions,
    });
    return job;
  }

  public runSQLStream(
    sqlCommand: string,
    options: Partial<BigQueryQueryOptions> = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const bigQuery = this.bigQuery;
    function streamBigQuery(
      onError: (error: Error) => void,
      onData: (data: QueryDataRow) => void,
      onEnd: () => void
    ) {
      let index = 0;
      function handleData(
        this: ResourceStream<RowMetadata>,
        rowMetadata: RowMetadata
      ) {
        onData(rowMetadata);
        index += 1;
        if (options.rowLimit !== undefined && index >= options.rowLimit) {
          this.end();
        }
      }
      bigQuery
        .createQueryStream(sqlCommand)
        .on("error", onError)
        .on("data", handleData)
        .on("end", onEnd);
    }
    return toAsyncGenerator<QueryDataRow>(streamBigQuery);
  }
}
