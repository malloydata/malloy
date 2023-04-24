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

import {DuckDBDialect} from './duckdb';
import {Dialect} from './dialect';
import {PostgresDialect} from './postgres/postgres';
import {StandardSQLDialect} from './standardsql/standardsql';
import {FunctionDef, FunctionOverloadDef} from '../model';
import {DialectFunctionOverloadDef} from './functions';

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
registerDialect(new DuckDBDialect());

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
            ot =>
              t.dataType === ot.dataType &&
              t.expressionType === ot.expressionType
          )
        )
      );
    })
  );
}

function paramsCompatible(
  a: DialectFunctionOverloadDef,
  b: FunctionOverloadDef
): boolean {
  // TODO detect when parameters are not exactly equal, but would cause collision issues...
  return paramsEqual(a, b);
}

function returnEqual(
  a: DialectFunctionOverloadDef,
  b: FunctionOverloadDef
): boolean {
  return (
    a.returnType.dataType === b.returnType.dataType &&
    a.returnType.expressionType === b.returnType.expressionType
  );
}

export function getDialectFunction(name: string): FunctionDef | undefined {
  const func: FunctionDef = {
    type: 'function',
    name,
    overloads: [],
  };
  let found = false;
  for (const dialect of dialectMap.values()) {
    const overloads = dialect.getGlobalFunctionDef(name);
    if (overloads) {
      for (const overload of overloads) {
        let handled = false;
        for (const existingOverload of func.overloads) {
          if (!paramsCompatible(overload, existingOverload)) {
            continue;
          }
          if (!paramsEqual(overload, existingOverload)) {
            throw new Error('params are compatible but not equal');
          }
          if (!returnEqual(overload, existingOverload)) {
            throw new Error('params match but return types differ!');
          }
          existingOverload.dialect[dialect.name] = overload.e;
          handled = true;
        }
        if (!handled) {
          func.overloads.push({
            returnType: overload.returnType,
            params: overload.params,
            dialect: {[dialect.name]: overload.e},
            needsWindowOrderBy: overload.needsWindowOrderBy,
          });
        }
      }
      found = true;
    }
  }
  return found ? func : undefined;
}
