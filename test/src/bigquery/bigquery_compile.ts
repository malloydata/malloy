/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as malloy from '@malloydata/malloy';
import {BigQueryConnection} from '@malloydata/db-bigquery';
import {testDatabase} from '../test_database';

/** The SQL of a query on a model. */
export async function compileQuery(
  model: malloy.ModelMaterializer,
  query: string
) {
  return await model.loadQuery(query).getSQL();
}

/**
 * Checks that BigQuery accepts the SQL: runs it as an unused CTE, and throws
 * BigQuery's error if BigQuery rejects it.
 */
export async function bqCompile(sql: string): Promise<boolean> {
  const bq = await testDatabase.connection();
  if (!(bq instanceof BigQueryConnection)) {
    throw new Error('BigQuery connection not found');
  }
  await bq.executeSQLRaw(`WITH test AS(\n${sql}) SELECT 1 as one`);
  return true;
}
