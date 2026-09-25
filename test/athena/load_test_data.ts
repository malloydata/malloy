/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

/*
 * Load the malloytest tables into Athena from the parquet files: each file
 * is uploaded to S3 and declared as an external table over its own prefix,
 * so Athena reads the parquet in place. Connects as the athena test runtime
 * does, through the ATHENA_* variables, plus:
 *
 *   ATHENA_TEST_DATA_LOCATION  s3://bucket/prefix/ that holds one directory
 *                              per table; the Glue database is malloytest
 *
 * Credentials are the AWS default chain (AWS_PROFILE for a local run).
 *
 *   sh test/athena/load_test_data.sh
 */

import {readFile} from 'fs/promises';
import {PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import type {QueryRecord} from '@malloydata/malloy';
import {
  AthenaConnection,
  AthenaExecutor,
} from '../../packages/malloy-db-athena';
import {
  openDuckDB,
  parquetPath,
  parquetTables,
  scalarTypesOnly,
} from '../data/parquet_loader';

const DATABASE = 'malloytest';

/**
 * The Hive spelling of a DuckDB scalar type, for CREATE EXTERNAL TABLE. A
 * parquet timestamp is UTC microseconds; Athena reads it into its
 * millisecond timestamp, zoned or not. Compound types are not declared:
 * the load plan leaves them out (see scalarTypesOnly).
 */
function hiveType(duckdbType: string): string {
  const decimal = duckdbType.match(/^DECIMAL(\(\d+,\d+\))$/);
  if (decimal) {
    return `decimal${decimal[1]}`;
  }
  switch (duckdbType) {
    case 'BIGINT':
      return 'bigint';
    case 'INTEGER':
      return 'int';
    case 'DOUBLE':
      return 'double';
    case 'VARCHAR':
      return 'string';
    case 'BOOLEAN':
      return 'boolean';
    case 'DATE':
      return 'date';
    case 'TIMESTAMP':
    case 'TIMESTAMP WITH TIME ZONE':
      return 'timestamp';
    default:
      throw new Error(`No Hive type for DuckDB type ${duckdbType}`);
  }
}

function text(row: QueryRecord, column: string): string {
  const value = row[column];
  if (typeof value !== 'string') {
    throw new Error(`DESCRIBE gave no ${column}`);
  }
  return value;
}

async function ddl(athena: AthenaConnection, sql: string): Promise<void> {
  await athena.runSQL(sql);
}

(async () => {
  const config = AthenaExecutor.getConnectionOptionsFromEnv();
  const location = process.env['ATHENA_TEST_DATA_LOCATION'];
  if (!config || !location) {
    throw new Error(
      'ATHENA_WORKGROUP and ATHENA_TEST_DATA_LOCATION (s3://bucket/prefix/) are required'
    );
  }
  const bucketPath = location.match(/^s3:\/\/([^/]+)\/(.*)$/);
  if (!bucketPath) {
    throw new Error(
      `ATHENA_TEST_DATA_LOCATION is not an s3://bucket/prefix/ URL: ${location}`
    );
  }
  const [, bucket, prefixRaw] = bucketPath;
  const prefix =
    prefixRaw.length > 0 && !prefixRaw.endsWith('/')
      ? `${prefixRaw}/`
      : prefixRaw;

  const s3 = new S3Client({region: config.region});
  const athena = new AthenaConnection('athena', config);
  const db = await openDuckDB();
  const plan = scalarTypesOnly;

  console.log(`Loading malloytest into Athena from s3://${bucket}/${prefix}`);
  await ddl(athena, `CREATE DATABASE IF NOT EXISTS ${DATABASE}`);
  for (const table of parquetTables()) {
    if (plan.skip?.includes(table)) {
      console.log(`  ${table}: skipped`);
      continue;
    }
    const omit = plan.omit?.find(o => o.table === table)?.columns ?? [];
    const described = await db.run(
      `DESCRIBE SELECT * FROM read_parquet('${parquetPath(table)}')`
    );
    const columns = described
      .map(row => ({
        name: text(row, 'column_name'),
        type: text(row, 'column_type'),
      }))
      .filter(c => !omit.includes(c.name));

    const key = `${prefix}${table}/${table}.parquet`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: await readFile(parquetPath(table)),
      })
    );

    // Glue lowercases every name; the parquet reader matches columns by name,
    // so a column the table does not declare is left unread.
    const declarations = columns.map(
      c => `  \`${c.name.toLowerCase()}\` ${hiveType(c.type)}`
    );
    await ddl(athena, `DROP TABLE IF EXISTS ${DATABASE}.${table}`);
    await ddl(
      athena,
      `CREATE EXTERNAL TABLE ${DATABASE}.${table} (\n${declarations.join(',\n')}\n)` +
        ` STORED AS PARQUET LOCATION 's3://${bucket}/${prefix}${table}/'`
    );

    const expected = (
      await db.run(
        `SELECT count(*) AS n FROM read_parquet('${parquetPath(table)}')`
      )
    )[0]['n'];
    const loaded = (
      await athena.runSQL(`SELECT count(*) AS n FROM ${DATABASE}.${table}`)
    ).rows[0]['n'];
    if (Number(loaded) !== Number(expected)) {
      throw new Error(
        `${table}: Athena counts ${loaded} rows, the parquet has ${expected}`
      );
    }
    console.log(`  ${table}: ${loaded} rows`);
  }
  await db.close();
  await athena.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
