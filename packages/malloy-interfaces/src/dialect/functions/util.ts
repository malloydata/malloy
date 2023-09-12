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

import {Expr} from '../../model';
import {
  FieldValueType,
  Fragment,
  FunctionParamTypeDesc,
  FunctionParameterDef,
  TypeDesc,
} from '../../model/malloy_types';

export function arg(name: string): Fragment {
  return {
    type: 'function_parameter',
    name,
  };
}

function interpolate<T>(outer: T[], inner: T[]): T[] {
  const result: T[] = [];
  for (let i = 0; i < outer.length; i++) {
    result.push(outer[i]);
    if (i < inner.length) {
      result.push(inner[i]);
    }
  }
  return result;
}

export function sql(
  strings: TemplateStringsArray,
  ...expr: (Fragment | string)[]
): Expr {
  return [
    {
      type: 'sql_expression',
      e: interpolate<Fragment>([...strings], expr),
    },
  ];
}

/**
 * Prefer `makeParam` for future function definitions
 */
export function param(
  name: string,
  ...allowedTypes: FunctionParamTypeDesc[]
): FunctionParameterDef {
  return {
    name,
    isVariadic: false,
    allowedTypes,
  };
}

export function makeParam(
  name: string,
  ...allowedTypes: FunctionParamTypeDesc[]
): {param: FunctionParameterDef; arg: Fragment} {
  return {param: param(name, ...allowedTypes), arg: arg(name)};
}

export function minScalar(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar',
    evalSpace: 'input',
  };
}

export interface DialectFunctionOverloadDef {
  // The expression type here is the MINIMUM return type
  returnType: TypeDesc;
  params: FunctionParameterDef[];
  e: Expr;
  needsWindowOrderBy?: boolean;
  between: {preceding: number | string; following: number | string} | undefined;
}

export function anyExprType(dataType: FieldValueType): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: undefined,
    evalSpace: 'input',
  };
}

export function overload(
  returnType: TypeDesc,
  params: FunctionParameterDef[],
  e: Expr,
  options?: {
    needsWindowOrderBy?: boolean;
    between?: {preceding: number | string; following: number | string};
  }
): DialectFunctionOverloadDef {
  return {
    returnType,
    params,
    e,
    needsWindowOrderBy: options?.needsWindowOrderBy,
    between: options?.between,
  };
}
