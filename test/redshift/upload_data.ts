/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

import {readFile} from 'fs/promises';
import * as path from 'path';
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';
import {Client} from 'pg';

const PARQUET_DIR = path.resolve(__dirname, '../data/malloytest-parquet');
const SCHEMA_SQL = path.resolve(__dirname, 'malloytest-redshift.sql');

const TABLES = [
  'aircraft',
  'aircraft_models',
  'airports',
  'alltypes',
  'carriers',
  'flights',
  'ga_sample',
  'state_facts',
];

// SUPER columns: parquet nested groups need SERIALIZETOJSON on COPY.
const SUPER_TABLES = new Set(['alltypes', 'ga_sample']);

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

function makeClient(): Client {
  const connectionString = process.env['REDSHIFT_CONNECTION_STRING'];
  if (connectionString) {
    return new Client({connectionString, ssl: {rejectUnauthorized: false}});
  }
  return new Client({
    host: requireEnv('REDSHIFT_HOST'),
    port: Number(process.env['REDSHIFT_PORT'] ?? 5439),
    user: process.env['REDSHIFT_USER'],
    password: process.env['REDSHIFT_PASSWORD'],
    database: process.env['REDSHIFT_DATABASE'],
    // rejectUnauthorized:false: loader moves only public test data, so don't pin the Amazon CA.
    ssl: {rejectUnauthorized: false},
  });
}

async function main() {
  const bucket = requireEnv('REDSHIFT_TEST_S3_BUCKET');
  const prefix = process.env['REDSHIFT_TEST_S3_PREFIX'] ?? 'malloytest';
  const region =
    process.env['REDSHIFT_TEST_S3_REGION'] ?? requireEnv('AWS_REGION');
  const iamRole = requireEnv('REDSHIFT_COPY_IAM_ROLE');

  const s3 = new S3Client({region});
  console.log(
    `Uploading ${TABLES.length} parquet files to s3://${bucket}/${prefix}/`
  );
  for (const table of TABLES) {
    const file = path.join(PARQUET_DIR, `${table}.parquet`);
    // Buffer not stream so the SDK can retry a dropped connection; fixtures are small.
    const body = await readFile(file);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}/${table}.parquet`,
        Body: body,
      })
    );
    console.log(`  uploaded ${table}.parquet`);
  }

  const client = makeClient();
  await client.connect();
  try {
    console.log('Creating schema and tables…');
    // Split DDL: Redshift plans a batch as one unit, so CREATE TABLE can't reference a schema created in the same batch.
    const ddl = await readFile(SCHEMA_SQL, 'utf8');
    for (const statement of ddl.split(';')) {
      if (statement.trim()) await client.query(statement);
    }

    for (const table of TABLES) {
      const s3uri = `s3://${bucket}/${prefix}/${table}.parquet`;
      const serialize = SUPER_TABLES.has(table) ? ' SERIALIZETOJSON' : '';
      console.log(`  COPY ${table} <- ${s3uri}`);
      await client.query(
        `COPY malloytest.${table} FROM '${s3uri}' IAM_ROLE '${iamRole}' FORMAT AS PARQUET${serialize};`
      );
    }
    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
