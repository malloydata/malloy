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

import type {DialectFunctionOverloadDef} from '../../../dialect';
import {getMalloyStandardFunctions} from '../../../dialect';
import {getDialects} from '../../../dialect/dialect_map';
import type {FunctionDef, FunctionOverloadDef} from '../../../model';
import {TD} from '../../../model';
import {BaseScope} from './scope';
import {
  FunctionNamespaceEntryInstance,
  type FunctionBinding,
  type Binding,
} from './bindings';

/**
 * This is a global namespace which exists in the root of all Documents
 * and includes SQL function definitions.
 */
export class GlobalScope extends BaseScope {
  constructor() {
    super(undefined, getDialectFunctions());
  }

  override setEntry(_name: string, _value: Binding): void {
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

export function getDialectFunctions(): Map<string, Binding> {
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
  const functions = new Map<string, FunctionBinding>();
  for (const name in baseImplementations) {
    const baseOverloads = baseImplementations[name];
    const functionDef: FunctionDef = {
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
      functionDef.overloads.push(overload);
    }
    functions.set(name, new FunctionNamespaceEntryInstance(functionDef));
  }
  return functions;
}
