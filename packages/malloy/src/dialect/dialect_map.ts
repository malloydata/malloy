/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DuckDBDialect} from './duckdb';
import type {Dialect} from './dialect';
import {PostgresDialect} from './postgres';
import {SnowflakeDialect} from './snowflake';
import {StandardSQLDialect} from './standardsql';
import {PrestoDialect, TrinoDialect} from './trino';
import {MySQLDialect} from './mysql';
import {DatabricksDialect} from './databricks';

const dialectMap = new Map<string, Dialect>();

export function getDialect(name: string): Dialect {
  const d = dialectMap.get(name);
  if (d === undefined) {
    throw new Error(`Unknown Dialect ${name}`);
  }
  return d;
}

export function registerDialect(d: Dialect): void {
  dialectMap.set(d.name, d);
}

export function getDialects(): Dialect[] {
  return [...dialectMap.values()];
}

registerDialect(new PostgresDialect());
registerDialect(new StandardSQLDialect());
registerDialect(new DuckDBDialect());
registerDialect(new SnowflakeDialect());
registerDialect(new TrinoDialect());
registerDialect(new PrestoDialect());
registerDialect(new MySQLDialect());
registerDialect(new DatabricksDialect());
