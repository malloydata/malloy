/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {activeName} from '../model/malloy_types';
import type {FieldDef, QueryFieldDef} from '../model/malloy_types';

type NamedFieldThing = FieldDef | QueryFieldDef;

export function nameFromDef(f1: NamedFieldThing): string {
  if (f1.type === 'fieldref') {
    return f1.path[f1.path.length - 1];
  }
  return activeName(f1);
}

export function mergeFields<T extends NamedFieldThing>(
  older: T[] | undefined,
  newer: T[]
): T[] {
  if (older === undefined) {
    return newer;
  }
  const redefined = new Set(newer.map(f => nameFromDef(f)));
  const merged = older.filter(f => !redefined.has(nameFromDef(f)));
  merged.push(...newer);
  return merged;
}
