/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {MALLOY_INTERFACE_TYPES} from './types';

export function nestUnions(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
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
    const typeDefinition = getType(type);
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

export function convertFromThrift(obj: unknown, type: string): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  } else if (typeof obj === 'string') {
    return obj;
  } else if (typeof obj === 'number') {
    if (type === 'number') return obj;
    const typeDefinition = getType(type);
    if (typeDefinition.type !== 'enum') {
      throw new Error(`Found a number where a ${type} was expected`);
    }
    const entry = Object.entries(typeDefinition.values).find(
      ([, value]) => value === obj
    );
    if (entry === undefined) {
      throw new Error(`${obj} is not a valid enum value for ${type}`);
    }
    return entry[0];
  } else if (Array.isArray(obj)) {
    return obj.map(value => convertFromThrift(value, type));
  } else {
    const typeDefinition = getType(type);
    if (typeDefinition.type === 'union') {
      for (const kind in typeDefinition.options) {
        if (obj[kind] !== undefined) {
          const result = convertFromThrift(
            obj[kind],
            typeDefinition.options[kind]
          );
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
        result[key] = convertFromThrift(obj[key], childType.type);
      }
      return result;
    } else {
      throw new Error(`Cannot unnest unions in an enum type ${type}`);
    }
  }
}

function getType(type: string) {
  const typeDefinition = MALLOY_INTERFACE_TYPES[type];
  if (typeDefinition === undefined) {
    throw new Error(`Unknown Malloy interface type ${type}`);
  }
  return typeDefinition;
}

export function convertToThrift(obj: unknown, type: string): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  } else if (typeof obj === 'number') {
    return obj;
  } else if (typeof obj === 'string') {
    if (type === 'string') return obj;
    const typeDefinition = getType(type);
    if (typeDefinition.type === 'enum') {
      const value = typeDefinition.values[obj];
      if (value === undefined) {
        throw new Error(`${obj} is not a valid enum value for ${type}`);
      }
      return value;
    }
  } else if (Array.isArray(obj)) {
    return obj.map(el => convertToThrift(el, type));
  } else {
    const typeDefinition = getType(type);
    if (typeDefinition.type === 'union') {
      const kind = obj['kind'];
      const unionType = typeDefinition.options[kind];
      if (unionType === undefined) {
        throw new Error(`${kind} is not a valid union of ${type}`);
      }
      const unionTypeDefinition = getType(unionType);
      if (unionTypeDefinition.type !== 'struct') {
        throw new Error('Union fields must be structs');
      }
      const result = {};
      for (const key in obj) {
        if (key === 'kind') continue;
        const childType = unionTypeDefinition.fields[key];
        result[key] = convertToThrift(obj[key], childType.type);
      }
      return {[kind]: result};
    } else if (typeDefinition.type === 'struct') {
      const result = {};
      for (const key in obj) {
        const childType = typeDefinition.fields[key];
        if (childType === undefined) {
          throw new Error(`Unknown field ${key} in ${type}`);
        }
        result[key] = convertToThrift(obj[key], childType.type);
      }
      return result;
    }
  }
}
