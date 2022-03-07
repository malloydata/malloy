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

import { QueryFieldDef, FieldDef } from "../model/malloy_types";

type Field = QueryFieldDef | FieldDef;

export function nameOf(qfd: Field): string {
  if (typeof qfd == "string") {
    return qfd;
  }
  return qfd.as || qfd.name;
}

export function mergeFields<T extends Field>(
  older: T[] | undefined,
  newer: T[]
): T[] {
  if (older == undefined) {
    return newer;
  }
  const redefined = new Set(newer.map((f) => nameOf(f)));
  const merged = older.filter((f) => !redefined.has(nameOf(f)));
  merged.push(...newer);
  return merged;
}
