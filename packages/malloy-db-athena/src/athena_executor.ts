/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {QueryData, QueryDataRow} from '@malloydata/malloy';
import {
  AthenaClient,
  StartQueryExecutionCommand,
  StartQueryExecutionCommandInput,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  GetTableMetadataCommand,
  GetTableMetadataCommandInput,
} from '@aws-sdk/client-athena';
import invariant from 'tiny-invariant';
// import * as dotenv from 'dotenv';

export interface ColumnMetadata {
  Name: string;
  // TrinoSQL raw type?
  Type: string;
}

export interface QueryDataWithMetaData {
  // column metadata for all non partition columns in the table
  columns: ColumnMetadata[];
  results: QueryData;
}

export interface AthenaConnOptions {
  aws_region: string;
  aws_access_key: string;
  aws_secret_key: string;
  catalog: string;
  database: string;
}

export class AthenaExecutor {
  private athenaClient: AthenaClient;

  constructor(private options: AthenaConnOptions) {
    this.athenaClient = new AthenaClient({
      region: options.aws_region,
      credentials: {
        accessKeyId: options.aws_access_key,
        secretAccessKey: options.aws_secret_key,
      },
    });
  }

  public static createFromEnv(): AthenaExecutor {
    const aws_region = process.env['AWS_REGION'];
    const aws_access_key = process.env['AWS_ACCESS_KEY'];
    const aws_secret_key = process.env['AWS_SECRET_KEY'];
    const catalog = process.env['CATALOG'];
    const database = process.env['DATABASE'];

    invariant(aws_region !== undefined, 'AWS_REGION is required');
    invariant(aws_access_key !== undefined, 'AWS_ACCESS_KEY is required');
    invariant(aws_secret_key !== undefined, 'AWS_SECRET_KEY is required');
    invariant(catalog !== undefined, 'CATALOG is required');
    invariant(database !== undefined, 'DATABASE is required');

    return new AthenaExecutor({
      aws_region,
      aws_access_key,
      aws_secret_key,
      catalog,
      database,
    });
  }

  private async getResults(
    executionId: string,
    read_data = true
  ): Promise<QueryDataWithMetaData> {
    const data = await this.athenaClient.send(
      new GetQueryResultsCommand({QueryExecutionId: executionId})
    );
    const ret: QueryDataWithMetaData = {columns: [], results: []};

    if (
      data.ResultSet === undefined ||
      data.ResultSet.Rows === undefined ||
      data.ResultSet.ResultSetMetadata === undefined
    ) {
      // throw new Error('no records found');
      return ret;
    }

    data.ResultSet.ResultSetMetadata.ColumnInfo?.forEach(column => {
      invariant(column.Name !== undefined, 'column name not found');
      invariant(column.Type !== undefined, 'column type not found');
      ret.columns.push({Name: column.Name, Type: column.Type});
    });

    if (!read_data) {
      return ret;
    }

    // first row is just the column names
    data.ResultSet.Rows.shift();
    data.ResultSet.Rows.forEach(record => {
      // TODO: ensure types are trinosql types then this can be simplified
      // make a common interface between executor and connection
      invariant(record.Data !== undefined, 'record data not found');
      const row = {} as QueryDataRow;
      record.Data.forEach((field, index) => {
        const columnName = ret.columns[index].Name;
        const columnType = ret.columns[index].Type;
        if (field.VarCharValue === 'null' || field.VarCharValue === undefined) {
          row[columnName] = null;
        } else {
          switch (columnType.toLowerCase()) {
            case 'bool':
            case 'boolean':
              if (field.VarCharValue === 'true') {
                row[columnName] = true;
              } else if (field.VarCharValue === 'false') {
                row[columnName] = false;
              }
              break;

            case 'int':
            case 'int2':
            case 'int4':
            case 'int8':
            case 'bigint':
            case 'smallint':
            case 'integer':
            case 'float':
            case 'float4':
            case 'float8':
            case 'real':
            case 'double':
            case 'numeric':
            case 'decimal':
            case 'double precision':
              row[columnName] = +field.VarCharValue;
              break;

            case 'char':
            case 'character':
            case 'nchar':
            case 'bpchar':
            case 'varchar':
            case 'nvarchar':
            case 'text':
            case 'character varying':
            case 'string':
            case 'date':
            case 'time':
            case 'timestamp':
              row[columnName] = field.VarCharValue;
              break;

            default:
              throw new Error(`unsupported column type: ${columnType}`);
          }
        }
      });
      ret.results.push(row);
    });
    return ret;
  }

  private async pollAndGetResults(
    executionId: string,
    read_data: boolean,
    timeoutMs: number
  ): Promise<QueryDataWithMetaData> {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);

    const sleep = async (ms: number) =>
      new Promise(resolve => setTimeout(resolve, ms));

    while (!timedOut) {
      const data = await this.athenaClient.send(
        new GetQueryExecutionCommand({QueryExecutionId: executionId})
      );
      if (data.QueryExecution?.Status?.State === 'SUCCEEDED') {
        clearTimeout(timeout);
        return await this.getResults(executionId);
      }
      if (data.QueryExecution?.Status?.State === 'FAILED') {
        clearTimeout(timeout);
        throw new Error(
          `${executionId}: ${data.QueryExecution.Status.AthenaError?.ErrorMessage}` ||
            'unknown error'
        );
      }
      await sleep(1_000);
    }
    throw new Error('timed out trying to fetch results');
  }

  public async batch(sqlText: string): Promise<QueryData> {
    const executionId = await this.athenaClient.send(
      new StartQueryExecutionCommand({
        QueryExecutionContext: {
          Database: this.options.database,
          Catalog: this.options.catalog,
        },
        QueryString: sqlText,
      } as StartQueryExecutionCommandInput)
    );
    if (!executionId.QueryExecutionId) {
      throw new Error('no execution id');
    }
    // try to fetch results within 5 minutes; else cancel the query and exit
    return (
      await this.pollAndGetResults(
        executionId.QueryExecutionId,
        true /* read_data */,
        60 * 5_000 /* timeout */
      )
    ).results;
  }

  public async describe_table(table: string): Promise<ColumnMetadata[]> {
    const desc = await this.athenaClient.send(
      new GetTableMetadataCommand({
        CatalogName: this.options.catalog,
        DatabaseName: this.options.database,
        TableName: table,
      } as GetTableMetadataCommandInput)
    );
    if (desc.TableMetadata?.Columns === undefined) {
      throw new Error(`no column list found for ${table}`);
    }

    const result: ColumnMetadata[] = [];
    for (const col of desc.TableMetadata.Columns) {
      const name = col.Name;
      const type = col.Type;
      invariant(name !== undefined, 'column name not found');
      invariant(type !== undefined, 'column type not found');
      result.push({Name: name, Type: type});
    }
    return result;
  }

  public async describe_clause(sqlText: string): Promise<ColumnMetadata[]> {
    const executionId = await this.athenaClient.send(
      new StartQueryExecutionCommand({
        QueryExecutionContext: {
          Database: this.options.database,
          Catalog: this.options.catalog,
        },
        QueryString: `select * from (${sqlText}) tbl where false`,
      } as StartQueryExecutionCommandInput)
    );
    if (!executionId.QueryExecutionId) {
      throw new Error('no execution id');
    }
    // try to fetch results within 5 minutes; else cancel the query and exit
    return (
      await this.pollAndGetResults(
        executionId.QueryExecutionId,
        false /* read_data */,
        60 * 5_000 /* timeout */
      )
    ).columns;
  }

  public async close(): Promise<void> {
    this.athenaClient.destroy();
  }
}

// dotenv.config();

// const executor = AthenaExecutor.createFromEnv();

// executor.describe_table('aircraft').then(data => {
//   console.log(data);
// });

// executor
//   .describe_clause(
//     'select id, array_agg(tail_num) as tails from malloytest.aircraft group by 1'
//   )
//   .then(data => {
//     console.log(data);
//   });

// executor.batch('SELECT * from malloytest.aircraft limit 2').then(data => {
//   console.log(data);
// });
