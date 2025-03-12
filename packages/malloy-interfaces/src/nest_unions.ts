/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MALLOY_INTERFACE_TYPES} from './types';

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

export function unnestUnions(obj: unknown, type: string): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  } else if (typeof obj === 'string' || typeof obj === 'number') {
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(value => unnestUnions(value, type));
  } else {
    if (type === undefined) {
      throw new Error('Cannot unnest unions of object without a type');
    }
    const typeDefinition = MALLOY_INTERFACE_TYPES[type];
    if (typeDefinition === undefined) {
      throw new Error(`Unknown Malloy interface type ${type}`);
    }
    if (typeDefinition.type === 'union') {
      for (const kind in typeDefinition.options) {
        if (obj[kind] !== undefined) {
          const result = unnestUnions(obj[kind], typeDefinition.options[kind]);
          if (typeof result === 'object') {
            return {
              kind,
              ...result,
            };
          }
        }
      }
    } else if (typeDefinition.type === 'struct') {
      const result = {};
      for (const key in obj) {
        const childType = typeDefinition.fields[key];
        if (childType === undefined) {
          throw new Error(`Unknown field ${key} in ${type}`);
        }
        result[key] = unnestUnions(obj[key], childType.type);
      }
      return result;
    } else {
      throw new Error(`Cannot unnest unions in an enum type ${type}`);
    }
  }
}
