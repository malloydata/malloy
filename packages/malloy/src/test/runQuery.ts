/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {API} from '..';
import type {ModelMaterializer} from '..';
import {cellsToObjects} from './cellsToObject';

/**
 * Result from running a query.
 */
export interface QueryResult {
  /** The query result data as an array of row objects */
  data: Record<string, unknown>[];
  /** The generated SQL */
  sql: string;
}

/**
 * Run a Malloy query and return the results.
 *
 * Uses the new malloy-interfaces API to normalize data across all databases.
 * Timestamps and dates are returned as ISO strings, booleans are normalized, etc.
 *
 * Throws an error with useful debugging info (query source, SQL, error message)
 * if compilation or execution fails. The stack trace will point to your call site.
 *
 * @example
 * const {data, sql} = await runQuery(testModel, `run: users -> { select: * }`);
 * expect(data.length).toBe(3);
 * expect(data[0]).toMatchObject({name: 'alice'});
 * expect(data[0]).toHaveProperty('orders.length', 2);  // nested array length
 * expect(data[0]).toHaveProperty('orders.0.amount', 100);  // nested element
 *
 * @param model - ModelMaterializer to run the query against
 * @param src - Malloy query source code
 * @returns Query result with data array and generated SQL
 */
export async function runQuery(
  model: ModelMaterializer,
  src: string
): Promise<QueryResult> {
  const cleanSrc = src.replace(/^\n+/, '').trimEnd();
  let query;
  let sql: string | undefined;

  try {
    query = model.loadQuery(src);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Query compilation failed:\n\nQUERY:\n${cleanSrc}\n\nERROR:\n${message}`
    );
  }

  try {
    sql = await query.getSQL();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `SQL generation failed:\n\nQUERY:\n${cleanSrc}\n\nERROR:\n${message}`
    );
  }

  try {
    const result = await query.run();
    // Use wrapResult to normalize data across all databases
    // This handles BigQuery timestamp wrappers, MySQL boolean 0/1, etc.
    const malloyResult = API.util.wrapResult(result);
    if (!malloyResult.data) {
      throw new Error('Query returned no data');
    }
    const data = cellsToObjects(malloyResult.data, malloyResult.schema);
    return {
      data,
      sql: sql!,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Query execution failed:\n\nQUERY:\n${cleanSrc}\n\nSQL:\n${sql}\n\nERROR:\n${message}`
    );
  }
}
