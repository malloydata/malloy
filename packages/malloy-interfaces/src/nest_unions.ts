/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export function nestUnions(obj: unknown): unknown {
  if (obj === null) {
    return obj;
  } else if (typeof obj === 'string' || typeof obj === 'number') {
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(nestUnions);
  } else {
    const result = {};
    let kind: string | undefined = undefined;
    for (const key in obj) {
      if (key === 'kind') {
        kind = obj[key];
      } else {
        result[key] = nestUnions(obj[key]);
      }
    }
    if (kind === undefined) {
      return result;
    } else {
      return {[kind]: result};
    }
  }
}
