/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import {ASTQuery} from './query-ast';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * expect(q => q.getOrCreateDefaultSegment().addGroupBy('carrier')).toModifyQuery({
       *   from: ...,
       *   to: ...,
       *   malloy: 'run: flights -> { group_by: carrier }'
       * });
       */
      toModifyQuery(exp: {
        model: Malloy.ModelInfo;
        from: Malloy.Query;
        to: Malloy.Query;
        malloy: string;
      }): R;
      toModifyQuery(exp: {
        source: Malloy.SourceInfo;
        from: Malloy.Query;
        to: Malloy.Query;
        malloy: string;
      }): R;
    }
  }
}

expect.extend({
  toModifyQuery(
    f: (q: ASTQuery) => void,
    {
      model,
      source,
      from,
      to,
      malloy,
    }: {
      model?: Malloy.ModelInfo;
      source?: Malloy.SourceInfo;
      from: Malloy.Query;
      to: Malloy.Query;
      malloy: string;
    }
  ) {
    const clone = JSON.parse(JSON.stringify(from));
    const q = model
      ? new ASTQuery({model, query: from})
      : source
      ? new ASTQuery({source, query: from})
      : undefined;
    if (q === undefined) {
      throw new Error('Must specify either model or source');
    }
    f(q);
    const query = q.build();
    const eq = objectsMatch(query, to);
    const diff = this.utils.diff(to, query);
    if (!eq) {
      return {
        pass: false,
        message: () => `Modified query object does not match expected: ${diff}`,
      };
    }
    try {
      ensureOnlyMinimalEdits(from, query, clone);
    } catch (error) {
      return {
        pass: false,
        message: () =>
          `Resulting query object should have minimal edits: ${error.message}`,
      };
    }
    const actualMalloy = q.toMalloy();
    const malloyDiff = this.utils.diff(malloy, actualMalloy);
    if (malloy !== actualMalloy) {
      return {
        pass: false,
        message: () =>
          `Resulting query text does not match expected: ${malloyDiff}`,
      };
    }
    return {
      pass: true,
      message: () => 'Result matched',
    };
  },
});

function ensureOnlyMinimalEdits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aClone: any,
  path: (string | number)[] = []
): boolean {
  if (
    typeof a === 'string' ||
    typeof a === 'number' ||
    typeof a === 'boolean'
  ) {
    return aClone !== b;
  }
  let different = false;
  if (Array.isArray(a)) {
    different = aClone.length !== b.length;
    for (let i = 0; i < aClone.length || i < b.length; i++) {
      if (a === undefined || b === undefined) {
        different = true;
      } else if (aClone[i] === b[i]) {
        different ||= ensureOnlyMinimalEdits(a[i], b[i], aClone[i], [
          ...path,
          i,
        ]);
      } else {
        different = true;
        const found = aClone.findIndex(f => f === b[i]);
        if (found !== -1) {
          ensureOnlyMinimalEdits(a[found], b[i], aClone[found], [...path, i]);
        }
      }
    }
  } else {
    for (const key in aClone) {
      different ||= ensureOnlyMinimalEdits(a[key], b[key], aClone[key], [
        ...path,
        key,
      ]);
    }
    for (const key in b) {
      if (key in aClone) continue;
      different = true;
    }
  }
  const sameObject = a === b;
  if (different) {
    if (sameObject) {
      throw new Error(`Path /${path.join('/')} was illegally mutated`);
    }
  } else {
    if (!sameObject) {
      throw new Error(`Path /${path.join('/')} was unnecessarily cloned`);
    }
  }
  return different;
}

function objectsMatch(a: unknown, b: unknown): boolean {
  if (
    typeof b === 'string' ||
    typeof b === 'number' ||
    typeof b === 'boolean' ||
    typeof b === 'bigint' ||
    b === undefined ||
    b === null
  ) {
    return b === a;
  } else if (Array.isArray(b)) {
    if (Array.isArray(a)) {
      return a.length === b.length && a.every((v, i) => objectsMatch(v, b[i]));
    }
    return false;
  } else {
    if (
      typeof a === 'string' ||
      typeof a === 'number' ||
      typeof a === 'boolean' ||
      typeof a === 'bigint' ||
      a === undefined ||
      a === null
    ) {
      return false;
    }
    if (Array.isArray(a)) return false;
    const keys = Object.keys(b);
    for (const key of keys) {
      if (!objectsMatch(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
}
