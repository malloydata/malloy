/*
 * Copyright 2021 Google LLC
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

import { Dialect } from "./dialect";
import { PostgresDialect } from "./postgres";
import { StandardSQLDialect } from "./standardsql";

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

registerDialect(new PostgresDialect());
registerDialect(new StandardSQLDialect());
