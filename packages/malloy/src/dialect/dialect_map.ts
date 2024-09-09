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

import {DuckDBDialect} from './duckdb';
import {Dialect} from './dialect';
import {PostgresDialect} from './postgres';
import {SnowflakeDialect} from './snowflake';
import {StandardSQLDialect} from './standardsql';
import {PrestoDialect, TrinoDialect} from './trino';

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
