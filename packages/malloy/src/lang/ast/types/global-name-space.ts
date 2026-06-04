/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DialectFunctionOverloadDef} from '../../../dialect';
import {getMalloyStandardFunctions} from '../../../dialect';
import {getDialects} from '../../../dialect/dialect_map';
import type {FunctionDef, FunctionOverloadDef} from '../../../model';
import {TD} from '../../../model';
import type {ModelEntry} from './model-entry';
import type {NameSpace} from './name-space';

/**
 * This is a global namespace which exists in the root of all Documents
 * and includes SQL function definitions.
 */
export class GlobalNameSpace implements NameSpace {
  entries: Map<string, FunctionDef>;
  constructor() {
    this.entries = getDialectFunctions();
  }

  getEntry(name: string): ModelEntry | undefined {
    const func = this.entries.get(name);
    if (func === undefined) {
      return undefined;
    }
    return {
      entry: func,
      exported: false,
    };
  }

  setEntry(_name: string, _value: ModelEntry, _exported: boolean): void {
    throw new Error('The global namespace is immutable!');
  }
}

function paramsEqual(
  a: DialectFunctionOverloadDef,
  b: FunctionOverloadDef
): boolean {
  return (
    a.params.length === b.params.length &&
    a.params.every((param, i) => {
      const otherParam = b.params[i];
      return (
        param.isVariadic === otherParam.isVariadic &&
        param.name === otherParam.name &&
        param.allowedTypes.length === otherParam.allowedTypes.length &&
        param.allowedTypes.every(t =>
          otherParam.allowedTypes.some(
            ot => TD.eq(t, ot) && t.expressionType === ot.expressionType
          )
        )
      );
    })
  );
}

export function getDialectFunctions(): Map<string, FunctionDef> {
  const baseImplementations = getMalloyStandardFunctions();
  const dialectOverrides: {
    [dialectName: string]: {
      [functionName: string]: DialectFunctionOverloadDef[];
    };
  } = {};
  const dialects = getDialects();
  for (const dialect of dialects) {
    dialectOverrides[dialect.name] = dialect.getDialectFunctionOverrides();
  }
  const functions = new Map<string, FunctionDef>();
  for (const name in baseImplementations) {
    const baseOverloads = baseImplementations[name];
    const func: FunctionDef = {
      type: 'function',
      name,
      overloads: [],
    };
    for (const baseOverload of baseOverloads) {
      const overload: FunctionOverloadDef = {
        returnType: baseOverload.returnType,
        params: baseOverload.params,
        dialect: {},
        supportsOrderBy: baseOverload.supportsOrderBy,
        supportsLimit: baseOverload.supportsLimit,
        genericTypes: baseOverload.genericTypes,
        isSymmetric: baseOverload.isSymmetric,
      };
      for (const dialect of dialects) {
        const overloads = dialectOverrides[dialect.name][name] ?? [];
        const dialectOverload =
          overloads.find(o => paramsEqual(o, overload)) ?? baseOverload;
        overload.dialect[dialect.name] = {
          e: dialectOverload.e,
          needsWindowOrderBy: dialectOverload.needsWindowOrderBy,
          between: dialectOverload.between,
          defaultOrderByArgIndex: dialectOverload.defaultOrderByArgIndex,
        };
      }
      func.overloads.push(overload);
    }
    functions.set(name, func);
  }
  return functions;
}
