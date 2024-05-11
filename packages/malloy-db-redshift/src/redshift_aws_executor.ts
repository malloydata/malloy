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
import * as crypto from 'crypto';
import {QueryData, QueryDataRow} from '@malloydata/malloy';
import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  DescribeStatementCommand,
  GetStatementResultCommand,
  ExecuteStatementCommandInput,
  DescribeTableCommand,
  DescribeTableCommandInput,
  BatchExecuteStatementCommand,
  BatchExecuteStatementCommandInput,
  DescribeStatementCommandOutput,
  ColumnMetadata,
} from '@aws-sdk/client-redshift-data';
import invariant from 'tiny-invariant';
import * as dotenv from 'dotenv';

export interface QueryDataWithMetaData {
  columns: ColumnMetadata[];
  results: QueryData;
}

export interface RedShiftAWSConnOptions {
  aws_region: string;
  aws_access_key: string;
  aws_secret_key: string;
  // used for identifying redshift cluster
  redshift_cluster_id?: string;
  // used for identifying redshift serverless workgroup
  redshift_workgroup?: string;
  database: string;
  db_secret_arn?: string;
  // db_user?: string;
  // db_password?: string;
}

export class RedShiftAWSExecutor {
  private redshiftDataClient: RedshiftDataClient;

  constructor(private options: RedShiftAWSConnOptions) {
    invariant(
      options.redshift_cluster_id !== undefined ||
        options.redshift_workgroup !== undefined,
      'either redshift_cluster_id or redshift_workgroup must be provided'
    );
    invariant(
      options.db_secret_arn !== undefined,
      // (options.db_user !== undefined && options.db_password !== undefined),
      'either db_secret_arn or db_user and db_password must be provided'
    );
    this.redshiftDataClient = new RedshiftDataClient({
      region: options.aws_region,
      credentials: {
        accessKeyId: options.aws_access_key,
        secretAccessKey: options.aws_secret_key,
      },
    });
  }

  public static createFromEnv(): RedShiftAWSExecutor {
    const aws_region = process.env['AWS_REGION'];
    const aws_access_key = process.env['AWS_ACCESS_KEY'];
    const aws_secret_key = process.env['AWS_SECRET_KEY'];
    const redshift_cluster_id = process.env['CLUSTER_ID'];
    const redshift_workgroup = process.env['WORKGROUP'];
    const database = process.env['DATABASE'];
    const db_secret_arn = process.env['DB_SECRET_ARN'];
    // const db_user = process.env['DB_USER'];
    // const db_password = process.env['DB_PASSWORD'];

    invariant(aws_region !== undefined, 'AWS_REGION is required');
    invariant(aws_access_key !== undefined, 'AWS_ACCESS_KEY is required');
    invariant(aws_secret_key !== undefined, 'AWS_SECRET_KEY is required');
    invariant(database !== undefined, 'DATABASE is required');

    return new RedShiftAWSExecutor({
      aws_region,
      aws_access_key,
      aws_secret_key,
      redshift_cluster_id,
      redshift_workgroup,
      database,
      db_secret_arn,
      // db_user,
      // db_password,
    });
  }

  private async getResults(
    statementId: string
  ): Promise<QueryDataWithMetaData> {
    const data = await this.redshiftDataClient.send(
      new GetStatementResultCommand({Id: statementId})
    );

    const results = [] as QueryData;
    if (
      data.Records === undefined ||
      data.TotalNumRows === undefined ||
      data.ColumnMetadata === undefined
    ) {
      // throw new Error('no records found');
      return {results: [], columns: []};
    }

    data.Records.forEach(record => {
      const row = {} as QueryDataRow;
      record.forEach((field, index) => {
        const metadata = data.ColumnMetadata?.[index];
        invariant(metadata !== undefined, 'column metadata not found');
        const columnName = metadata?.name;
        invariant(columnName !== undefined, 'column name not found');
        const columnType = metadata?.typeName;
        invariant(columnType !== undefined, 'column type not found');

        if (field.isNull === true) {
          row[columnName] = null;
        } else {
          // TODO: has potential to be refactored and unified with dialect.sqlTypeToMalloyType
          // Check the column data type and extract the value accordingly
          switch (columnType.toLowerCase()) {
            case 'bool':
            case 'boolean':
              // Use booleanValue
              invariant(
                field.booleanValue !== undefined,
                'boolean value not found'
              );
              row[columnName] = field.booleanValue;
              break;

            case 'char':
            case 'character':
            case 'nchar':
            case 'bpchar':
            case 'varchar':
            case 'nvarchar':
            case 'text':
            case 'character varying':
            case 'date':
            case 'time':
            case 'timestamp':
              // Use stringValue
              invariant(
                field.stringValue !== undefined,
                'string value not found'
              );
              row[columnName] = field.stringValue;
              break;

            case 'int':
            case 'int2':
            case 'int4':
            case 'int8':
            case 'bigint':
            case 'smallint':
            case 'integer':
              // Use longValue
              invariant(field.longValue !== undefined, 'long value not found');
              row[columnName] = field.longValue;
              break;

            case 'float':
            case 'float4':
            case 'float8':
            case 'real':
            case 'double':
            case 'numeric':
            case 'decimal':
            case 'double precision':
              // Use doubleValue
              invariant(
                field.doubleValue !== undefined,
                'double value not found'
              );
              row[columnName] = field.doubleValue;
              break;

            default:
              throw new Error(`unsupported column type: ${columnType}`);
          }
        }
      });
      results.push(row);
    });
    return {columns: data.ColumnMetadata, results: results};
  }

  private async pollAndGetResults(
    statementId: string,
    get_statementId: (DescribeStatementCommandOutput) => string,
    timeoutMs: number
  ): Promise<QueryDataWithMetaData> {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);

    const sleep = async (ms: number) =>
      new Promise(resolve => setTimeout(resolve, ms));

    while (!timedOut) {
      const data = await this.redshiftDataClient.send(
        new DescribeStatementCommand({Id: statementId})
      );
      if (data.Status === 'FINISHED') {
        clearTimeout(timeout);
        if (data.HasResultSet) {
          return await this.getResults(get_statementId(data));
        }
        return {results: [], columns: []};
      }
      if (data.Status === 'FAILED') {
        clearTimeout(timeout);
        throw new Error(`${statementId}: ${data.Error}` || 'unknown error');
      }
      await sleep(1_000);
    }
    throw new Error('timed out trying to fetch results');
  }

  public async batch(sqlText: string): Promise<QueryData> {
    const statementId = await this.redshiftDataClient.send(
      new ExecuteStatementCommand({
        ClusterIdentifier: this.options.redshift_cluster_id,
        WorkgroupName: this.options.redshift_workgroup,
        Database: this.options.database,
        Sql: sqlText,
        SecretArn: this.options.db_secret_arn,
        WorkGroup: this.options.redshift_workgroup,
      } as ExecuteStatementCommandInput)
    );
    if (!statementId.Id) {
      throw new Error('no statement id');
    }
    // try to fetch results within 4 minutes; else cancel the query and exit
    return (
      await this.pollAndGetResults(
        statementId.Id,
        (_data: DescribeStatementCommand) => {
          invariant(statementId.Id !== undefined, 'no statement id');
          return statementId.Id;
        },
        60 * 4_000
      )
    ).results;
  }

  public async describe_table(
    table: string,
    schema?: string
  ): Promise<Map<string, string>> {
    const desc = await this.redshiftDataClient.send(
      new DescribeTableCommand({
        ClusterIdentifier: this.options.redshift_cluster_id,
        WorkgroupName: this.options.redshift_workgroup,
        Database: this.options.database,
        Schema: schema,
        Table: table,
        SecretArn: this.options.db_secret_arn,
      } as DescribeTableCommandInput)
    );
    if (desc.ColumnList === undefined) {
      throw new Error(`no column list found for ${schema}.${table}`);
    }

    invariant(desc.ColumnList !== undefined, 'no columns found');
    const result: Map<string, string> = new Map();
    for (const col of desc.ColumnList) {
      const name = col.name;
      const type = col.typeName;
      invariant(name !== undefined, 'column name not found');
      invariant(type !== undefined, 'column type not found');
      result.set(name, type);
    }
    return result;
  }

  private getTempViewName(sqlCommand: string): string {
    const hash = crypto.createHash('md5').update(sqlCommand).digest('hex');
    return `tt${hash}`;
  }

  public async describe_clause(sql: string): Promise<Map<string, string>> {
    const tempTable = this.getTempViewName(sql);
    const statementId = await this.redshiftDataClient.send(
      new BatchExecuteStatementCommand({
        ClusterIdentifier: this.options.redshift_cluster_id,
        WorkgroupName: this.options.redshift_workgroup,
        Database: this.options.database,
        Sqls: [
          `create temporary table ${tempTable} as (select * from (${sql}) where false);`,
          `select * from ${tempTable} limit 1;`,
        ],
        SecretArn: this.options.db_secret_arn,
        WorkGroup: this.options.redshift_workgroup,
      } as BatchExecuteStatementCommandInput)
    );
    if (!statementId.Id) {
      throw new Error('no statement id');
    }

    // try to fetch results within 4 minutes; else cancel the query and exit
    const ret = await this.pollAndGetResults(
      statementId.Id,
      (data: DescribeStatementCommandOutput) => {
        if (data.SubStatements === undefined) {
          throw new Error('no sub statements found');
        }
        if (data.SubStatements.length !== 2) {
          throw new Error('expected 2 sub statements');
        }
        const subStatement = data.SubStatements[1];
        if (subStatement.Id === undefined) {
          throw new Error('no sub statement id');
        }
        return subStatement.Id;
      },
      60 * 4_000
    );

    invariant(ret.columns !== undefined, 'no columns found');
    const result: Map<string, string> = new Map();
    for (const col of ret.columns) {
      const name = col.name;
      const type = col.typeName;
      invariant(name !== undefined, 'column name not found');
      invariant(type !== undefined, 'column type not found');
      result.set(name, type);
    }
    return result;
  }

  public async close(): Promise<void> {
    this.redshiftDataClient.destroy();
  }
}

// dotenv.config();
// const executor = RedShiftAWSExecutor.createFromEnv();
// executor.describe_table('aircraft', 'malloytest').then(data => {
//   console.log(data);
// });
// executor
//   .describe_clause("SELECT 1 as a, 'a' as b, '2024-01-01'::date as c")
//   .then(data => {
//     console.log(data);
//   });
// executor.batch('SELECT * from malloytest.aircraft limit 2').then(data => {
//   console.log(data);
// });
