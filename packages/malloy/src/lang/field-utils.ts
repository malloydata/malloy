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

import {FieldDef, QueryFieldDef} from '../model/malloy_types';

type NamedFieldThing = FieldDef | QueryFieldDef;

export function nameFromDef(f1: NamedFieldThing): string {
  if (f1.type === 'fieldref') {
    return f1.path[f1.path.length - 1];
  }
  return f1.as ?? f1.name;
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
