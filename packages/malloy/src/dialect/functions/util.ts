/*
 * Copyright 2023 Google LLC
 * Copyright (c) Meta Platforms, Inc. and affiliates.
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

import type {
  FunctionParameterDef,
  TypeDesc,
  Expr,
  FunctionParamTypeDesc,
  GenericSQLExpr,
  LeafExpressionType,
  FieldDef,
  FunctionReturnTypeDesc,
  FunctionParameterTypeDef,
  ExpressionType,
  EvalSpace,
  FunctionReturnTypeDef,
  TypedDef,
  FunctionGenericTypeDef,
} from '../../model/malloy_types';
import {TD, mkFieldDef} from '../../model/malloy_types';
import type {SQLExprElement} from '../../model/utils';

export interface DialectFunctionOverloadDef {
  // The expression type here is the MINIMUM return type
  returnType: FunctionReturnTypeDesc;
  params: FunctionParameterDef[];
  genericTypes?: {name: string; acceptibleTypes: FunctionGenericTypeDef[]}[];
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

export function constant<
  T extends {expressionType: ExpressionType | undefined},
>(type: T): T & TypeDescExtras {
  return {
    ...type,
    evalSpace: 'constant',
  };
}

export function output<T extends {expressionType: ExpressionType | undefined}>(
  type: T
): T & TypeDescExtras {
  return {
    ...type,
    evalSpace: 'output',
  };
}

export function literal<T extends {expressionType: ExpressionType | undefined}>(
  type: T
): T & TypeDescExtras {
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

export function maxScalar<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: 'scalar', evalSpace: 'input'};
}

export function maxAggregate<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: 'aggregate', evalSpace: 'input'};
}

export function anyExprType<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: undefined, evalSpace: 'input'};
}

export function maxUngroupedAggregate(
  type: FunctionParameterTypeDef
): FunctionParamTypeDesc {
  return {...type, expressionType: 'ungrouped_aggregate', evalSpace: 'input'};
}

type TypeDescExtras = {
  expressionType: ExpressionType | undefined;
  evalSpace: EvalSpace;
};

export function maxAnalytic<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: 'aggregate_analytic', evalSpace: 'input'};
}

export function minScalar<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: 'scalar', evalSpace: 'input'};
}

export function minAggregate<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: 'aggregate', evalSpace: 'input'};
}

export function minAnalytic<T>(type: T): T & TypeDescExtras {
  return {...type, expressionType: 'scalar_analytic', evalSpace: 'input'};
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
  array: TypeDescElementBlueprintOrNamedGeneric;
}
export type TypeDescElementBlueprintOrNamedGeneric =
  | TypeDescElementBlueprint
  | NamedGeneric;
export interface RecordBlueprint {
  record: Record<string, TypeDescElementBlueprintOrNamedGeneric>;
}

export interface SQLNativeTypeBlueprint {
  sql_native: string;
}

export type LeafPlusType = LeafExpressionType | 'any';
export type TypeDescElementBlueprint =
  | LeafPlusType
  | ArrayBlueprint
  | RecordBlueprint
  | SQLNativeTypeBlueprint;
export type NamedGeneric = {generic: string};

export type TypeDescBlueprint =
  | TypeDescElementBlueprintOrNamedGeneric
  | {literal: TypeDescElementBlueprintOrNamedGeneric}
  | {constant: TypeDescElementBlueprintOrNamedGeneric}
  | {dimension: TypeDescElementBlueprintOrNamedGeneric}
  | {measure: TypeDescElementBlueprintOrNamedGeneric}
  | {calculation: TypeDescElementBlueprintOrNamedGeneric};

type ParamTypeBlueprint =
  | TypeDescBlueprint
  | TypeDescBlueprint[]
  | {variadic: TypeDescBlueprint | TypeDescBlueprint[]};

export interface SignatureBlueprint {
  generic?: {[name: string]: TypeDescElementBlueprintOrNamedGeneric[]};
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

function expandTypeDescElementBlueprint(
  blueprint: TypeDescElementBlueprintOrNamedGeneric,
  allowAny: false
): FunctionReturnTypeDef;
function expandTypeDescElementBlueprint(
  blueprint: TypeDescElementBlueprintOrNamedGeneric,
  allowAny?: true
): FunctionParameterTypeDef;
function expandTypeDescElementBlueprint(
  blueprint: TypeDescElementBlueprintOrNamedGeneric,
  allowAny: true,
  allowGenerics: false
): FunctionGenericTypeDef;
function expandTypeDescElementBlueprint(
  blueprint: TypeDescElementBlueprintOrNamedGeneric,
  allowAny = true,
  allowGenerics = true
): FunctionParameterTypeDef | FunctionReturnTypeDef | TypedDef {
  if (!allowAny && blueprint === 'any') {
    throw new Error('Return type cannot include any');
  }
  if (typeof blueprint === 'string') {
    return {type: blueprint};
  } else if ('array' in blueprint) {
    const innerType = allowAny
      ? expandTypeDescElementBlueprint(blueprint.array, true)
      : expandTypeDescElementBlueprint(blueprint.array, false);
    if (innerType.type === 'record') {
      return {
        type: 'array',
        elementTypeDef: {type: 'record_element'},
        fields: innerType.fields,
      };
    }
    return {
      type: 'array',
      elementTypeDef: innerType,
    };
  } else if ('record' in blueprint) {
    const fields: FieldDef[] = [];
    for (const [fieldName, fieldBlueprint] of Object.entries(
      blueprint.record
    )) {
      const fieldDesc = allowAny
        ? expandTypeDescElementBlueprint(fieldBlueprint, true)
        : expandTypeDescElementBlueprint(fieldBlueprint, false);
      if (TD.isAtomic(fieldDesc)) {
        fields.push(mkFieldDef(fieldDesc, fieldName));
      }
    }
    return {
      type: 'record',
      fields,
    };
  } else if ('generic' in blueprint) {
    if (!allowGenerics) {
      throw new Error('Cannot use generic');
    }
    return {type: 'generic', generic: blueprint.generic};
  } else if ('sql_native' in blueprint) {
    return {type: 'sql native', rawType: blueprint.sql_native};
  }
  throw new Error('Cannot figure out type');
}

function expandReturnTypeBlueprint(
  blueprint: TypeDescBlueprint
): FunctionReturnTypeDesc {
  if (blueprint === 'any') {
    throw new Error('Cannot return any type');
  }
  if (typeof blueprint === 'string') {
    return minScalar({type: blueprint});
  } else if ('array' in blueprint) {
    return anyExprType(expandTypeDescElementBlueprint(blueprint, false));
  } else if ('record' in blueprint) {
    return anyExprType(expandTypeDescElementBlueprint(blueprint, false));
  } else if ('generic' in blueprint) {
    return minScalar(expandTypeDescElementBlueprint(blueprint, false));
  } else if ('literal' in blueprint) {
    return literal(
      minScalar(expandTypeDescElementBlueprint(blueprint.literal, false))
    );
  } else if ('constant' in blueprint) {
    return constant(
      minScalar(expandTypeDescElementBlueprint(blueprint.constant, false))
    );
  } else if ('dimension' in blueprint) {
    return minScalar(
      expandTypeDescElementBlueprint(blueprint.dimension, false)
    );
  } else if ('measure' in blueprint) {
    return minAggregate(
      expandTypeDescElementBlueprint(blueprint.measure, false)
    );
  } else if ('sql_native' in blueprint) {
    return anyExprType({type: 'sql native', rawType: blueprint.sql_native});
  } else {
    return minAnalytic(
      expandTypeDescElementBlueprint(blueprint.calculation, false)
    );
  }
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
    'calculation' in blueprint ||
    'sql_native' in blueprint
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
  blueprint: TypeDescBlueprint
): FunctionParamTypeDesc {
  if (typeof blueprint === 'string') {
    return anyExprType({type: blueprint});
  } else if ('generic' in blueprint) {
    return anyExprType(expandTypeDescElementBlueprint(blueprint));
  } else if ('literal' in blueprint) {
    return literal(
      maxScalar(expandTypeDescElementBlueprint(blueprint.literal))
    );
  } else if ('constant' in blueprint) {
    return constant(
      maxScalar(expandTypeDescElementBlueprint(blueprint.constant))
    );
  } else if ('dimension' in blueprint) {
    return maxScalar(expandTypeDescElementBlueprint(blueprint.dimension));
  } else if ('measure' in blueprint) {
    return maxAggregate(expandTypeDescElementBlueprint(blueprint.measure));
  } else if ('array' in blueprint) {
    return anyExprType(expandTypeDescElementBlueprint(blueprint, false));
  } else if ('record' in blueprint) {
    return anyExprType(expandTypeDescElementBlueprint(blueprint, false));
  } else if ('sql_native' in blueprint) {
    return anyExprType({type: 'sql native', rawType: blueprint.sql_native});
  } else {
    return maxAnalytic(expandTypeDescElementBlueprint(blueprint.calculation));
  }
}

function expandParamTypeBlueprints(blueprints: TypeDescBlueprint[]) {
  return blueprints.map(blueprint => expandParamTypeBlueprint(blueprint));
}

function isVariadicParamBlueprint(blueprint: ParamTypeBlueprint): boolean {
  return typeof blueprint !== 'string' && 'variadic' in blueprint;
}

function expandParamBlueprint(
  name: string,
  blueprint: ParamTypeBlueprint
): FunctionParameterDef {
  return {
    name,
    allowedTypes: expandParamTypeBlueprints(
      extractParamTypeBlueprints(blueprint)
    ),
    isVariadic: isVariadicParamBlueprint(blueprint),
  };
}

function expandParamsBlueprints(blueprints: {
  [name: string]: ParamTypeBlueprint;
}) {
  const paramsArray = Object.entries(blueprints);
  return paramsArray.map(blueprint =>
    expandParamBlueprint(blueprint[0], blueprint[1])
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

function expandGenericDefinitions(
  blueprint:
    | {[name: string]: TypeDescElementBlueprintOrNamedGeneric[]}
    | undefined
): {name: string; acceptibleTypes: FunctionGenericTypeDef[]}[] | undefined {
  if (blueprint === undefined) return undefined;
  return Object.entries(blueprint).map(([name, acceptibleTypes]) => ({
    name: name,
    acceptibleTypes: acceptibleTypes.map(t =>
      expandTypeDescElementBlueprint(t, true, false)
    ),
  }));
}

function expandBlueprint(
  blueprint: DefinitionBlueprint
): DialectFunctionOverloadDef {
  return {
    returnType: expandReturnTypeBlueprint(blueprint.returns),
    params: expandParamsBlueprints(blueprint.takes),
    isSymmetric: blueprint.isSymmetric,
    supportsOrderBy: blueprint.supportsOrderBy,
    supportsLimit: blueprint.supportsLimit,
    genericTypes: expandGenericDefinitions(blueprint.generic),
    ...expandImplBlueprint(blueprint),
  };
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
    return [expandBlueprint(blueprint)];
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
  return [expandBlueprint({...base, impl})];
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

/**
 * Walks a type and returns all the generic references
 * @param tdbp A type
 */
function* findGenerics(
  tdbp: TypeDescBlueprint
): IterableIterator<NamedGeneric> {
  if (typeof tdbp !== 'string') {
    if ('generic' in tdbp) {
      yield tdbp;
    } else if ('record' in tdbp) {
      for (const recType of Object.values(tdbp.record)) {
        yield* findGenerics(recType);
      }
    } else {
      for (const leaflet of [
        'array',
        'literal',
        'measure',
        'dimension',
        'measure',
        'constant',
        'cacluation',
      ]) {
        if (leaflet in tdbp) {
          yield* findGenerics(tdbp[leaflet]);
          return;
        }
      }
    }
  }
}

/**
 * Shortcut for non overloaded functions definitions. Default implementation
 * will be the function name turned to upper case. Default type for
 * any generics encountered will be `['any']`. Both of these can be over-ridden
 * in the `options` parameter.
 *
 * The two implict defaults (which can be over-ridden) are that the
 * impl: will be the upper case version of the function name, and that
 * any generic reference will be of type 'any'.
 *
 * USAGE:
 *
 *     ...def('func_name', {'arg0': 'type0', 'arg1': 'type1'}, 'return-type')
 *
 * @param name name of function
 * @param takes Record<Argument blueprint>
 * @param returns Return Blueprint
 * @param options Everything from a `DefinitionBlueprint` except `takes` and `returns`
 * @returns dot dot dot able blueprint definition
 */
export function def(
  name: string,
  takes: Record<string, TypeDescBlueprint>,
  returns: TypeDescBlueprint,
  options: Partial<Omit<DefinitionBlueprint, 'takes' | 'returns'>> = {}
) {
  let anyGenerics = false;
  const generic: {[name: string]: TypeDescElementBlueprintOrNamedGeneric[]} =
    {};
  for (const argType of Object.values(takes)) {
    for (const genericRef of findGenerics(argType)) {
      generic[genericRef.generic] = ['any'];
      anyGenerics = true;
    }
  }
  // We have found all the generic references and given them all
  // T: ['any']. Use this as a default if the options section
  // doesn't provide types for the generics.
  if (anyGenerics) {
    if (options.generic === undefined) {
      options.generic = generic;
    }
  }
  const newDef: DefinitionBlueprint = {
    takes,
    returns,
    impl: {function: name.toUpperCase()},
    ...options,
  };
  return {[name]: newDef};
}
