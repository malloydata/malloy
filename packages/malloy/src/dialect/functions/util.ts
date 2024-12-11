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

import {emptyCompositeFieldUsage} from '../../model/composite_source_utils';
import {
  FunctionParameterDef,
  TypeDesc,
  Expr,
  FunctionParamTypeDesc,
  GenericSQLExpr,
  LeafExpressionType,
  TD,
  mkFieldDef,
  FieldDef,
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

export function constant(type: FunctionParamTypeDesc): FunctionParamTypeDesc {
  return {
    ...type,
    evalSpace: 'constant',
  };
}

export function output(type: FunctionParamTypeDesc): FunctionParamTypeDesc {
  return {
    ...type,
    evalSpace: 'output',
  };
}

export function literal(type: FunctionParamTypeDesc): FunctionParamTypeDesc {
  return {
    ...type,
    evalSpace: 'literal',
  };
}

export function variadicParam(
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

export function maxScalar(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: 'scalar', evalSpace: 'input'};
}

export function maxAggregate(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: 'aggregate', evalSpace: 'input'};
}

export function anyExprType(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: undefined, evalSpace: 'input'};
}

export function anyExprTypeBP(type: TypeDescBlueprint): FunctionParamTypeDesc {
  const typeDesc = expandReturnTypeBlueprint(type, undefined);
  return {...typeDesc, expressionType: undefined, evalSpace: 'input'};
}

export function maxUngroupedAggregate(
  type: LeafExpressionType
): FunctionParamTypeDesc {
  return {type, expressionType: 'ungrouped_aggregate', evalSpace: 'input'};
}

export function maxAnalytic(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: 'aggregate_analytic', evalSpace: 'input'};
}

export function minScalar(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: 'scalar', evalSpace: 'input'};
}

export function minAggregate(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: 'aggregate', evalSpace: 'input'};
}

export function minAnalytic(type: LeafExpressionType): FunctionParamTypeDesc {
  return {type, expressionType: 'scalar_analytic', evalSpace: 'input'};
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

export interface ArrayBlueprint {
  array: TypeDescElementBlueprint;
}
export interface RecordBlueprint {
  record: Record<string, TypeDescElementBlueprint>;
}
export type TypeDescElementBlueprint =
  | LeafExpressionType
  | ArrayBlueprint
  | RecordBlueprint;

export type TypeDescBlueprint =
  | TypeDescElementBlueprint
  | {generic: string}
  | {literal: LeafExpressionType | {generic: string}}
  | {constant: LeafExpressionType | {generic: string}}
  | {dimension: LeafExpressionType | {generic: string}}
  | {measure: LeafExpressionType | {generic: string}}
  | {calculation: LeafExpressionType | {generic: string}};

type ParamTypeBlueprint =
  | TypeDescBlueprint
  | TypeDescBlueprint[]
  | {variadic: TypeDescBlueprint | TypeDescBlueprint[]};

export interface SignatureBlueprint {
  // today only one generic is allowed, but if we need more
  // we could change this to `{[name: string]: ExpressionValueType[]}`
  generic?: [string, LeafExpressionType[]];
  takes: {[name: string]: ParamTypeBlueprint};
  returns: TypeDescBlueprint;
  supportsOrderBy?: boolean | 'only_default';
  supportsLimit?: boolean;
  isSymmetric?: boolean;
}

interface ImplementationBlueprintBase {
  needsWindowOrderBy?: boolean;
  between?: {preceding: number | string; following: number | string};
  defaultOrderByArgIndex?: number;
}

interface ImplementationBlueprintSql extends ImplementationBlueprintBase {
  sql: string;
}

interface ImplementationBlueprintExpr extends ImplementationBlueprintBase {
  expr: Expr;
}

interface ImplementationBlueprintFunction extends ImplementationBlueprintBase {
  function: string;
}

export type ImplementationBlueprint =
  | ImplementationBlueprintSql
  | ImplementationBlueprintExpr
  | ImplementationBlueprintFunction;

export interface DefinitionBlueprint extends SignatureBlueprint {
  impl: ImplementationBlueprint;
}

export type OverloadedDefinitionBlueprint = {
  [signatureName: string]: DefinitionBlueprint;
};

export type DefinitionBlueprintMap = {
  [name: string]: DefinitionBlueprint | OverloadedDefinitionBlueprint;
};

export type OverloadedImplementationBlueprint = {
  [signatureName: string]: ImplementationBlueprint;
};

export type OverrideMap = {
  [name: string]: ImplementationBlueprint | OverloadedImplementationBlueprint;
};

function removeGeneric(
  type: LeafExpressionType | {generic: string},
  generic: {name: string; type: LeafExpressionType} | undefined
) {
  if (typeof type === 'string') {
    return type;
  }
  if (type.generic !== generic?.name) {
    throw new Error(`Cannot expand generic name ${type.generic}`);
  }
  return generic.type;
}

function expandReturnTypeBlueprint(
  blueprint: TypeDescBlueprint,
  generic: {name: string; type: LeafExpressionType} | undefined
): TypeDesc {
  let base: FunctionParamTypeDesc;
  if (typeof blueprint === 'string') {
    base = minScalar(blueprint);
  } else if ('array' in blueprint) {
    const innerType = expandReturnTypeBlueprint(blueprint.array, generic);
    const {expressionType, evalSpace} = innerType;
    if (TD.isAtomic(innerType)) {
      if (innerType.type !== 'record') {
        base = {
          type: 'array',
          elementTypeDef: innerType,
          expressionType,
          evalSpace,
        };
      } else {
        base = {
          type: 'array',
          elementTypeDef: {type: 'record_element'},
          fields: innerType.fields,
          expressionType,
          evalSpace,
        };
      }
    } else {
      // mtoy todo  fix by doing "exapndElementBlueprint" ...
      throw new Error(
        `TypeDescElementBlueprint should never allow ${blueprint.array}`
      );
    }
  } else if ('record' in blueprint) {
    const fields: FieldDef[] = [];
    for (const [fieldName, fieldBlueprint] of Object.entries(
      blueprint.record
    )) {
      const fieldDesc = expandReturnTypeBlueprint(fieldBlueprint, generic);
      if (TD.isAtomic(fieldDesc)) {
        fields.push(mkFieldDef(fieldDesc, fieldName));
      }
    }
    base = {
      type: 'record',
      fields,
      evalSpace: 'input',
      expressionType: 'scalar',
    };
  } else if ('generic' in blueprint) {
    base = minScalar(removeGeneric(blueprint, generic));
  } else if ('literal' in blueprint) {
    base = literal(minScalar(removeGeneric(blueprint.literal, generic)));
  } else if ('constant' in blueprint) {
    base = constant(minScalar(removeGeneric(blueprint.constant, generic)));
  } else if ('dimension' in blueprint) {
    base = minScalar(removeGeneric(blueprint.dimension, generic));
  } else if ('measure' in blueprint) {
    base = minAggregate(removeGeneric(blueprint.measure, generic));
  } else {
    base = minAnalytic(removeGeneric(blueprint.calculation, generic));
  }
  return {
    ...base,
    compositeFieldUsage: emptyCompositeFieldUsage(),
    expressionType: base.expressionType ?? 'scalar',
  };
}

function isTypeDescBlueprint(
  blueprint: ParamTypeBlueprint
): blueprint is TypeDescBlueprint {
  return (
    typeof blueprint === 'string' ||
    'array' in blueprint ||
    'record' in blueprint ||
    'generic' in blueprint ||
    'literal' in blueprint ||
    'constant' in blueprint ||
    'dimension' in blueprint ||
    'measure' in blueprint ||
    'calculation' in blueprint
  );
}

function extractParamTypeBlueprints(
  blueprint: ParamTypeBlueprint
): TypeDescBlueprint[] {
  if (isTypeDescBlueprint(blueprint)) {
    return [blueprint];
  } else if (Array.isArray(blueprint)) {
    return blueprint;
  } else if (isTypeDescBlueprint(blueprint.variadic)) {
    return [blueprint.variadic];
  } else {
    return blueprint.variadic;
  }
}

function expandParamTypeBlueprint(
  blueprint: TypeDescBlueprint,
  generic: {name: string; type: LeafExpressionType} | undefined
): FunctionParamTypeDesc {
  if (typeof blueprint === 'string') {
    return anyExprType(blueprint);
  } else if ('generic' in blueprint) {
    return anyExprType(removeGeneric(blueprint, generic));
  } else if ('literal' in blueprint) {
    return literal(maxScalar(removeGeneric(blueprint.literal, generic)));
  } else if ('constant' in blueprint) {
    return constant(maxScalar(removeGeneric(blueprint.constant, generic)));
  } else if ('dimension' in blueprint) {
    return maxScalar(removeGeneric(blueprint.dimension, generic));
  } else if ('measure' in blueprint) {
    return maxAggregate(removeGeneric(blueprint.measure, generic));
  } else if ('array' in blueprint) {
    return anyExprTypeBP(blueprint);
  } else if ('record' in blueprint) {
    return anyExprTypeBP(blueprint);
  } else {
    return maxAnalytic(removeGeneric(blueprint.calculation, generic));
  }
}

function expandParamTypeBlueprints(
  blueprints: TypeDescBlueprint[],
  generic: {name: string; type: LeafExpressionType} | undefined
) {
  return blueprints.map(blueprint =>
    expandParamTypeBlueprint(blueprint, generic)
  );
}

function isVariadicParamBlueprint(blueprint: ParamTypeBlueprint): boolean {
  return typeof blueprint !== 'string' && 'variadic' in blueprint;
}

function expandParamBlueprint(
  name: string,
  blueprint: ParamTypeBlueprint,
  generic: {name: string; type: LeafExpressionType} | undefined
): FunctionParameterDef {
  return {
    name,
    allowedTypes: expandParamTypeBlueprints(
      extractParamTypeBlueprints(blueprint),
      generic
    ),
    isVariadic: isVariadicParamBlueprint(blueprint),
  };
}

function expandParamsBlueprints(
  blueprints: {[name: string]: ParamTypeBlueprint},
  generic: {name: string; type: LeafExpressionType} | undefined
) {
  const paramsArray = Object.entries(blueprints);
  return paramsArray.map(blueprint =>
    expandParamBlueprint(blueprint[0], blueprint[1], generic)
  );
}

function expandBlueprintSqlInterpolation(sql: string): Expr {
  const src: string[] = [];
  const args: Expr[] = [];
  let current = sql;
  while (current.length > 0) {
    const start = current.indexOf('${');
    if (start === -1) {
      src.push(current);
      break;
    }
    const left = current.slice(0, start);
    current = current.slice(start);
    const end = current.indexOf('}');
    if (end === -1) {
      src.push(left + current);
      break;
    }
    const arg = current.slice(2, end);
    current = current.slice(end + 1);
    const isSpread = arg.startsWith('...');
    const isSpecial = arg.endsWith(':');
    const name = isSpread ? arg.slice(3) : isSpecial ? arg.slice(0, -1) : arg;
    const param: Expr = {node: 'function_parameter', name};
    src.push(left);
    // TODO validate that there is a param with this name?
    if (isSpread) {
      args.push({node: 'spread', e: param, prefix: '', suffix: ''});
    } else if (isSpecial && name === 'order_by') {
      args.push({node: 'aggregate_order_by'});
    } else if (isSpecial && name === 'limit') {
      args.push({node: 'aggregate_limit'});
    } else {
      args.push(param);
    }
  }
  const node: GenericSQLExpr = {
    node: 'genericSQLExpr',
    kids: {args},
    src,
  };
  return node;
}

function makeParamReplacement(
  name: string,
  blueprint: ParamTypeBlueprint
): Expr {
  if (isVariadicParamBlueprint(blueprint)) {
    return {
      node: 'spread',
      e: {node: 'function_parameter', name},
      prefix: '',
      suffix: '',
    };
  }
  return {node: 'function_parameter', name};
}

function expandBlueprintFunction(
  name: string,
  blueprint: DefinitionBlueprint
): Expr {
  const takesArray = Object.entries(blueprint.takes);
  const numCommas = takesArray.length > 0 ? takesArray.length - 1 : 0;
  return {
    node: 'genericSQLExpr',
    kids: {
      args: takesArray.map(param => makeParamReplacement(param[0], param[1])),
    },
    src: [`${name}(`, ...Array(numCommas).fill(','), ')'],
  };
}

function expendImplExprBlueprint(blueprint: DefinitionBlueprint): Expr {
  if ('sql' in blueprint.impl) {
    return expandBlueprintSqlInterpolation(blueprint.impl.sql);
  } else if ('expr' in blueprint.impl) {
    return blueprint.impl.expr;
  } else {
    return expandBlueprintFunction(blueprint.impl.function, blueprint);
  }
}

function expandImplBlueprint(blueprint: DefinitionBlueprint): {
  e: Expr;
  between: {preceding: string | number; following: string | number} | undefined;
  needsWindowOrderBy: boolean | undefined;
  defaultOrderByArgIndex: number | undefined;
} {
  return {
    e: expendImplExprBlueprint(blueprint),
    between: blueprint.impl.between,
    needsWindowOrderBy: blueprint.impl.needsWindowOrderBy,
    defaultOrderByArgIndex: blueprint.impl.defaultOrderByArgIndex,
  };
}

function expandOneBlueprint(
  blueprint: DefinitionBlueprint,
  generic?: {name: string; type: LeafExpressionType}
): DialectFunctionOverloadDef {
  return {
    returnType: expandReturnTypeBlueprint(blueprint.returns, generic),
    params: expandParamsBlueprints(blueprint.takes, generic),
    isSymmetric: blueprint.isSymmetric,
    supportsOrderBy: blueprint.supportsOrderBy,
    supportsLimit: blueprint.supportsLimit,
    ...expandImplBlueprint(blueprint),
  };
}

function expandBlueprint(
  blueprint: DefinitionBlueprint
): DialectFunctionOverloadDef[] {
  if (blueprint.generic !== undefined) {
    const name = blueprint.generic[0];
    return blueprint.generic[1].map(type =>
      expandOneBlueprint(blueprint, {name, type})
    );
  }
  return [expandOneBlueprint(blueprint)];
}

function isDefinitionBlueprint(
  blueprint: DefinitionBlueprint | OverloadedDefinitionBlueprint
): blueprint is DefinitionBlueprint {
  return 'takes' in blueprint && 'returns' in blueprint && 'impl' in blueprint;
}

function isImplementationBlueprint(
  blueprint: ImplementationBlueprint | OverloadedImplementationBlueprint
): blueprint is ImplementationBlueprint {
  return 'function' in blueprint || 'sql' in blueprint || 'expr' in blueprint;
}

function expandOverloadedBlueprint(
  blueprint: DefinitionBlueprint | OverloadedDefinitionBlueprint
): DialectFunctionOverloadDef[] {
  if (isDefinitionBlueprint(blueprint)) {
    return expandBlueprint(blueprint);
  } else {
    return Object.values(blueprint).flatMap(overload =>
      expandBlueprint(overload)
    );
  }
}

export function expandBlueprintMap(blueprints: DefinitionBlueprintMap) {
  const map: {[name: string]: DialectFunctionOverloadDef[]} = {};
  for (const name in blueprints) {
    map[name] = expandOverloadedBlueprint(blueprints[name]);
  }
  return map;
}

function expandImplementationBlueprint(
  base: DefinitionBlueprint,
  impl: ImplementationBlueprint
): DialectFunctionOverloadDef[] {
  return expandBlueprint({...base, impl});
}

function expandOverloadedOverrideBlueprint(
  name: string,
  base: DefinitionBlueprint | OverloadedDefinitionBlueprint,
  blueprint: ImplementationBlueprint | OverloadedImplementationBlueprint
): DialectFunctionOverloadDef[] {
  if (isImplementationBlueprint(blueprint)) {
    if (!isDefinitionBlueprint(base)) {
      throw new Error(
        `Malformed function override: ${name}. Attempt to override multiple overloads with a single overload (missing: ${Object.keys(
          base
        )})`
      );
    }
    return expandImplementationBlueprint(base, blueprint);
  } else {
    if (isDefinitionBlueprint(base)) {
      throw new Error(
        `Malformed function override: ${name}. Attempt to override a single overload with multiple overloads (extraneous: ${Object.keys(
          blueprint
        )})`
      );
    }
    return Object.entries(blueprint).flatMap(([overloadName, overload]) => {
      const baseOverload = base[overloadName];
      if (baseOverload === undefined) {
        throw new Error(
          `Malformed function override: ${name}. No overload named ${overloadName}`
        );
      }
      return expandImplementationBlueprint(baseOverload, overload);
    });
  }
}

export function expandOverrideMapFromBase(
  base: DefinitionBlueprintMap,
  overrides: OverrideMap
): {
  [name: string]: DialectFunctionOverloadDef[];
} {
  const map: {[name: string]: DialectFunctionOverloadDef[]} = {};
  for (const name in overrides) {
    if (!(name in base)) {
      throw new Error(
        `Malformed function override: ${name}. No such function in Malloy standard`
      );
    }
    map[name] = expandOverloadedOverrideBlueprint(
      name,
      base[name],
      overrides[name]
    );
  }
  return map;
}
