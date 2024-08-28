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

import {
  FunctionParameterDef,
  FieldValueType,
  TypeDesc,
  Expr,
  FunctionParamTypeDesc,
  GenericSQLExpr,
} from '../../model/malloy_types';
import {SQLExprElement} from '../../model/utils';

export interface DialectFunctionOverloadDef {
  // The expression type here is the MINIMUM return type
  returnType: TypeDesc;
  params: FunctionParameterDef[];
  e: Expr;
  needsWindowOrderBy?: boolean;
  isSymmetric?: boolean;
  supportsOrderBy?: boolean | 'only_default';
  defaultOrderByArgIndex?: number;
  supportsLimit?: boolean;
  between: {preceding: number | string; following: number | string} | undefined;
}

export function arg(name: string): Expr {
  return {node: 'function_parameter', name};
}

export function spread(
  e: Expr,
  prefix: string | undefined = undefined,
  suffix: string | undefined = undefined
): Expr {
  return {node: 'spread', e, prefix, suffix};
}

export function sql(
  strings: TemplateStringsArray,
  ...subExprs: SQLExprElement[]
): Expr {
  const ret: GenericSQLExpr = {
    node: 'genericSQLExpr',
    kids: {args: []},
    src: [],
  };
  const safeExprs = [...subExprs];
  let srcToPush = '';
  for (const str of strings) {
    srcToPush += str;
    const arg = safeExprs.shift();
    if (arg !== undefined) {
      if (typeof arg === 'string') {
        srcToPush += arg;
      } else {
        ret.src.push(srcToPush);
        ret.kids.args.push(arg);
        srcToPush = '';
      }
    }
  }
  if (srcToPush.length > 0) {
    ret.src.push(srcToPush);
  }
  return ret;
}

export function constant(type: TypeDesc): TypeDesc {
  return {
    ...type,
    evalSpace: 'constant',
  };
}

export function output(type: TypeDesc): TypeDesc {
  return {
    ...type,
    evalSpace: 'output',
  };
}

export function literal(type: TypeDesc): TypeDesc {
  return {
    ...type,
    evalSpace: 'literal',
  };
}

export function params(
  name: string,
  ...allowedTypes: FunctionParamTypeDesc[]
): FunctionParameterDef {
  return {
    name,
    isVariadic: true,
    allowedTypes,
  };
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
): {param: FunctionParameterDef; arg: Expr} {
  return {param: param(name, ...allowedTypes), arg: arg(name)};
}

export function maxScalar(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar',
    evalSpace: 'input',
  };
}

export function maxAggregate(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'aggregate',
    evalSpace: 'input',
  };
}

export function anyExprType(dataType: FieldValueType): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: undefined,
    evalSpace: 'input',
  };
}

export function maxUngroupedAggregate(
  dataType: FieldValueType
): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: 'ungrouped_aggregate',
    evalSpace: 'input',
  };
}

export function maxAnalytic(dataType: FieldValueType): FunctionParamTypeDesc {
  return {
    dataType,
    expressionType: 'aggregate_analytic',
    evalSpace: 'input',
  };
}

export function minScalar(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar',
    evalSpace: 'input',
  };
}

export function minAggregate(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'aggregate',
    evalSpace: 'input',
  };
}

export function minAnalytic(dataType: FieldValueType): TypeDesc {
  return {
    dataType,
    expressionType: 'scalar_analytic',
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
    isSymmetric?: boolean;
    supportsLimit?: boolean;
    defaultOrderByArgIndex?: number;
    supportsOrderBy?: boolean | 'only_default';
  }
): DialectFunctionOverloadDef {
  return {
    returnType,
    params,
    e,
    needsWindowOrderBy: options?.needsWindowOrderBy,
    between: options?.between,
    isSymmetric: options?.isSymmetric,
    supportsOrderBy: options?.supportsOrderBy,
    defaultOrderByArgIndex: options?.defaultOrderByArgIndex,
    supportsLimit: options?.supportsLimit,
  };
}
