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

import type {
  AtomicTypeDef,
  EvalSpace,
  Expr,
  ExpressionType,
  FunctionCallNode,
  FunctionDef,
  ExpressionValueTypeDef,
  FunctionGenericTypeDef,
  FunctionOverloadDef,
  FunctionParameterDef,
  FunctionParameterFieldDef,
  FunctionParameterTypeDef,
  FunctionReturnTypeDef,
  FunctionReturnTypeDesc,
  RecordFunctionParameterTypeDef,
  RecordFunctionReturnTypeDef,
  RecordTypeDef,
  FieldUsage,
  FunctionOrderBy as ModelFunctionOrderBy,
  AggregateUngrouping,
} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsScalar,
  expressionIsUngroupedAggregate,
  isAtomic,
  isAtomicFieldType,
  isExpressionTypeLEQ,
  isRepeatedRecordFunctionParam,
  isBasicArray,
  maxOfExpressionTypes,
  mergeEvalSpaces,
  TD,
} from '../../../model/malloy_types';
import {errorFor} from '../ast-utils';
import {StructSpaceFieldBase} from '../field-space/struct-space-field-base';

import type {FieldReference} from '../query-items/field-references';
import type {FunctionOrdering} from './function-ordering';
import type {Limit} from '../query-properties/limit';
import type {PartitionBy} from './partition_by';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {FieldName} from '../types/field-space';
import type {SQLExprElement} from '../../../model/utils';
import {composeSQLExpr} from '../../../model/utils';
import * as TDU from '../typedesc-utils';
import {mergeFieldUsage} from '../../composite-source-utils';
import type {AnyMessageCodeAndParameters} from '../../parse-log';

export class ExprFunc extends ExpressionDef {
  elementType = 'function call()';
  constructor(
    readonly name: string,
    readonly args: ExpressionDef[],
    readonly isRaw: boolean,
    readonly explicitType: AtomicTypeDef | undefined,
    readonly source?: FieldReference
  ) {
    super({args: args});
    this.has({source: source});
  }

  canSupportPartitionBy() {
    return true;
  }

  canSupportOrderBy() {
    return true;
  }

  canSupportLimit() {
    return true;
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.getPropsExpression(fs);
  }

  private findFunctionDef(
    dialect: string | undefined
  ):
    | {found: FunctionDef; error: undefined}
    | {found: undefined; error: string} {
    // TODO this makes functions case-insensitive. This is weird that this is the only place
    // where case insensitivity is thing.
    const normalizedName = this.name.toLowerCase();
    const dialectFunc = dialect
      ? this.getDialectNamespace(dialect)?.getEntry(normalizedName)?.entry
      : undefined;
    const func = dialectFunc ?? this.modelEntry(normalizedName)?.entry;
    if (func === undefined) {
      this.logError(
        'function-not-found',
        `Unknown function '${this.name}'. Use '${this.name}!(...)' to call a SQL function directly.`
      );
      return {found: undefined, error: 'unknown function'};
    } else if (func.type !== 'function') {
      this.logError(
        'call-of-non-function',
        `'${this.name}' (with type ${func.type}) is not a function`
      );
      return {found: undefined, error: 'called non function'};
    }
    if (func.name !== this.name) {
      this.logWarning(
        'case-insensitive-function',
        `Case insensitivity for function names is deprecated, use '${func.name}' instead`
      );
    }
    return {found: func, error: undefined};
  }

  getPropsExpression(
    fs: FieldSpace,
    props?: {
      partitionBys?: PartitionBy[];
      orderBys?: FunctionOrdering[];
      limit?: Limit;
    }
  ): ExprValue {
    const argExprsWithoutImplicit = this.args.map(arg => arg.getExpression(fs));
    if (this.isRaw) {
      const funcCall: SQLExprElement[] = [`${this.name}(`];
      argExprsWithoutImplicit.forEach((expr, i) => {
        if (i !== 0) {
          funcCall.push(',');
        }
        funcCall.push(expr.value);
      });
      funcCall.push(')');

      const inferredType = argExprsWithoutImplicit[0] ?? {type: 'number'};
      const dataType: ExpressionValueTypeDef =
        this.explicitType ?? inferredType;
      return computedExprValue({
        dataType,
        value: composeSQLExpr(funcCall),
        from: argExprsWithoutImplicit,
      });
    }
    const dialect = fs.dialectObj()?.name;
    const {found: func, error} = this.findFunctionDef(dialect);
    if (func === undefined) {
      return errorFor(error);
    }
    // Find the 'implicit argument' for aggregate functions called like `some_join.some_field.agg(...args)`
    // where the full arg list is `(some_field, ...args)`.
    let implicitExpr: ExprValue | undefined = undefined;
    let structPath = this.source?.path;
    if (this.source) {
      const lookup = this.source.getField(fs);
      const sourceFoot = lookup.found;
      if (sourceFoot) {
        const footType = sourceFoot.typeDesc();
        if (isAtomicFieldType(footType.type)) {
          implicitExpr = {
            ...TDU.atomicDef(footType),
            expressionType: footType.expressionType,
            value: {
              node: 'field',
              path: this.source.path,
              at: this.source.location,
            },
            evalSpace: footType.evalSpace,
            fieldUsage: [{path: this.source.path, at: this.source.location}],
          };
          structPath = this.source.path.slice(0, -1);
        } else {
          if (!(sourceFoot instanceof StructSpaceFieldBase)) {
            return this.loggedErrorExpr(
              'invalid-aggregate-source',
              `Aggregate source cannot be a ${footType.type}`
            );
          }
        }
      } else {
        this.loggedErrorExpr(
          'aggregate-source-not-found',
          `Reference to undefined value ${this.source.refString}`
        );
      }
    }
    // Construct the full args list including the implicit arg.
    const argExprs = [
      ...(implicitExpr ? [implicitExpr] : []),
      ...argExprsWithoutImplicit,
    ];
    const result = findOverload(func, argExprs);
    if (result === undefined) {
      return this.loggedErrorExpr(
        'no-matching-function-overload',
        `No matching overload for function ${this.name}(${argExprs
          .map(e => e.type)
          .join(', ')})`
      );
    }
    const {
      overload,
      expressionTypeErrors,
      evalSpaceErrors,
      nullabilityErrors,
      returnType,
    } = result;
    // Report errors for expression type mismatch
    for (const error of expressionTypeErrors) {
      const adjustedIndex = error.argIndex - (implicitExpr ? 1 : 0);
      const allowed = expressionIsScalar(error.maxExpressionType)
        ? 'scalar'
        : 'scalar or aggregate';
      const arg = this.args[adjustedIndex];
      arg.logError(
        'invalid-function-argument-expression-type',
        `Parameter ${error.argIndex + 1} ('${error.param.name}') of ${
          this.name
        } must be ${allowed}, but received ${error.actualExpressionType}`
      );
    }
    // Report errors for eval space mismatch
    for (const error of evalSpaceErrors) {
      const adjustedIndex = error.argIndex - (implicitExpr ? 1 : 0);
      const allowed =
        error.maxEvalSpace === 'literal'
          ? 'literal'
          : error.maxEvalSpace === 'constant'
            ? 'literal or constant'
            : 'literal, constant or output';
      const arg = this.args[adjustedIndex];
      arg.logError(
        'invalid-function-argument-evaluation-space',
        `Parameter ${error.argIndex + 1} ('${error.param.name}') of ${
          this.name
        } must be ${allowed}, but received ${error.actualEvalSpace}`
      );
    }
    // Report nullability errors
    for (const error of nullabilityErrors) {
      const adjustedIndex = error.argIndex - (implicitExpr ? 1 : 0);
      const arg = this.args[adjustedIndex];
      arg.logError(
        'literal-null-function-argument',
        `Parameter ${error.argIndex + 1} ('${error.param.name}') of ${
          this.name
        } must not be a literal null`
      );
    }
    // Report return type error
    if (result.returnTypeError) {
      this.logError(
        result.returnTypeError.code,
        result.returnTypeError.parameters
      );
    }
    const type = overload.returnType;
    const expressionType = maxOfExpressionTypes([
      type.expressionType ?? 'scalar',
      ...argExprs.map(e => e.expressionType),
    ]);
    if (
      !expressionIsAggregate(overload.returnType.expressionType) &&
      this.source !== undefined
    ) {
      return this.loggedErrorExpr(
        'non-aggregate-function-with-source',
        `Cannot call function ${this.name}(${argExprs
          .map(e => e.type)
          .join(', ')}) with source`
      );
    }
    const frag: FunctionCallNode = {
      node: 'function_call',
      overload,
      name: this.name,
      kids: {args: argExprs.map(x => x.value)},
      expressionType,
      structPath,
    };
    let funcCall: Expr = frag;
    const isAnalytic = expressionIsAnalytic(overload.returnType.expressionType);
    const isAsymmetric = !overload.isSymmetric;
    const orderByUsage: FieldUsage[] = [];
    // TODO add in an error if you use an asymmetric function in BQ
    // and the function uses joins
    // TODO add in an error if you use an illegal join pattern
    if (props?.orderBys && props.orderBys.length > 0) {
      if (!isAnalytic) {
        if (!this.inExperiment('aggregate_order_by', true)) {
          props.orderBys[0].logError(
            'aggregate-order-by-experiment-not-enabled',
            'Enable experiment `aggregate_order_by` to use `order_by` with an aggregate function'
          );
        }
      }
      if (overload.supportsOrderBy || isAnalytic) {
        const allowExpression = overload.supportsOrderBy !== 'only_default';
        const allOrderBy: ModelFunctionOrderBy[] = [];
        for (const ordering of props.orderBys) {
          const {orderBy, fieldUsage} = isAnalytic
            ? ordering.getAnalyticOrderBy(fs)
            : ordering.getAggregateOrderBy(fs, allowExpression);
          if (fieldUsage) {
            orderByUsage.push(...fieldUsage);
          }
          allOrderBy.push(...orderBy);
        }
        frag.kids.orderBy = allOrderBy;
      } else {
        props.orderBys[0].logError(
          'function-does-not-support-order-by',
          `Function \`${this.name}\` does not support \`order_by\``
        );
      }
    }
    if (props?.limit !== undefined) {
      if (overload.supportsLimit) {
        frag.limit = props.limit.limit;
      } else {
        this.logError(
          'function-does-not-support-limit',
          `Function ${this.name} does not support limit`
        );
      }
    }
    if (props?.partitionBys && props.partitionBys.length > 0) {
      const partitionByFields: string[] = [];
      for (const partitionBy of props.partitionBys) {
        for (const partitionField of partitionBy.partitionFields) {
          const e = partitionField.getField(fs);
          if (e.found === undefined) {
            partitionField.logError(
              'partition-by-not-found',
              `${partitionField.refString} is not defined`
            );
          } else if (
            expressionIsAnalytic(e.found.typeDesc().expressionType) ||
            expressionIsUngroupedAggregate(e.found.typeDesc().expressionType)
          ) {
            partitionField.logError(
              'non-scalar-or-aggregate-partition-by',
              'Partition expression must be scalar or aggregate'
            );
          } else {
            partitionByFields.push(partitionField.nameString);
          }
        }
      }
      frag.partitionBy = partitionByFields;
    }
    const sqlFunctionFieldUsage: FieldUsage[] = [];
    if (
      [
        'sql_number',
        'sql_string',
        'sql_date',
        'sql_timestamp',
        'sql_boolean',
      ].includes(func.name)
    ) {
      if (!this.inExperiment('sql_functions', true)) {
        return this.loggedErrorExpr(
          'sql-functions-experiment-not-enabled',
          `Cannot use sql_function \`${func.name}\`; use \`sql_functions\` experiment to enable this behavior`
        );
      }

      const str = argExprs[0].value;
      if (str.node !== 'stringLiteral') {
        this.logError(
          'invalid-sql-function-argument',
          `Invalid string literal for \`${func.name}\``
        );
      } else {
        const literal = str.literal;
        const parts = parseSQLInterpolation(literal);

        const expr: SQLExprElement[] = [];
        for (const part of parts) {
          if (part.type === 'string') {
            expr.push(part.value);
          } else if (part.path.length === 1 && part.path[0] === 'TABLE') {
            expr.push({node: 'source-reference'});
          } else {
            const names = part.path.map(p => new FieldName(p));
            this.has({names});
            const result = fs.lookup(names);
            if (result.found === undefined) {
              return this.loggedErrorExpr(
                'sql-function-interpolation-not-found',
                `Invalid interpolation: ${result.error.message}`
              );
            }
            const typeDesc = result.found.typeDesc();
            if (typeDesc.type === 'filter expression') {
              return this.loggedErrorExpr(
                'filter-expression-error',
                'Filter expressions cannot be used in sql_ functions'
              );
            }
            if (result.found.refType === 'parameter') {
              expr.push({node: 'parameter', path: part.path});
            } else {
              sqlFunctionFieldUsage.push({
                path: part.path,
                at: this.args[0].location,
              });
              expr.push({
                node: 'field',
                // TODO when we have namespaces, this will need to be replaced with the resolved path
                path: part.path,
                at: this.args[0].location,
              });
            }
          }
        }

        funcCall = composeSQLExpr(expr);
      }
    }
    const maxEvalSpace = mergeEvalSpaces(...argExprs.map(e => e.evalSpace));
    // If the merged eval space of all args is constant, the result is constant.
    // If the expression is scalar, then the eval space is that merged eval space.
    // If the expression is aggregate, then then eval space is always 'output'.
    // If the expression is analytic, the eval space doesn't really matter.. It's really
    // 'super_output' but that's not useful to us, so it's just 'output'.
    const evalSpace =
      maxEvalSpace === 'constant'
        ? 'constant'
        : expressionIsScalar(expressionType)
          ? maxEvalSpace
          : 'output';
    const aggregateFunctionUsage: FieldUsage[] = [];
    if (isAsymmetric || isAnalytic) {
      const funcUsage: FieldUsage = {path: structPath || [], at: this.location};
      if (isAsymmetric) funcUsage.uniqueKeyRequirement = {isCount: false};
      if (isAnalytic) funcUsage.analyticFunctionUse = true;
      aggregateFunctionUsage.push(funcUsage);
    }
    const fieldUsage = mergeFieldUsage(
      ...argExprs.map(ae => ae.fieldUsage),
      orderByUsage,
      sqlFunctionFieldUsage,
      aggregateFunctionUsage
    );
    const ungroupings = argExprs.reduce(
      (ug: AggregateUngrouping[], a) => a.ungroupings ?? ug,
      []
    );

    // TODO consider if I can use `computedExprValue` here...
    // seems like the rules for the evalSpace is a bit different from normal though
    return {
      // TODO need to handle this???
      ...(isAtomic(returnType) ? TDU.atomicDef(returnType) : returnType),
      expressionType,
      value: funcCall,
      evalSpace,
      fieldUsage,
      ungroupings,
    };
  }
}

type ExpressionTypeError = {
  argIndex: number;
  actualExpressionType: ExpressionType;
  maxExpressionType: ExpressionType;
  param: FunctionParameterDef;
};

type EvalSpaceError = {
  argIndex: number;
  param: FunctionParameterDef;
  actualEvalSpace: EvalSpace;
  maxEvalSpace: EvalSpace;
};

type NullabilityError = {
  argIndex: number;
  param: FunctionParameterDef;
};

function findOverload(
  func: FunctionDef,
  args: ExprValue[]
):
  | {
      overload: FunctionOverloadDef;
      expressionTypeErrors: ExpressionTypeError[];
      evalSpaceErrors: EvalSpaceError[];
      nullabilityErrors: NullabilityError[];
      returnType: ExpressionValueTypeDef;
      returnTypeError?: AnyMessageCodeAndParameters;
    }
  | undefined {
  for (const overload of func.overloads) {
    // Map from generic name to selected type
    const genericsSelected = new Map<string, ExpressionValueTypeDef>();
    let paramIndex = 0;
    let ok = true;
    let matchedVariadic = false;
    const expressionTypeErrors: ExpressionTypeError[] = [];
    const evalSpaceErrors: EvalSpaceError[] = [];
    const nullabilityErrors: NullabilityError[] = [];
    for (let argIndex = 0; argIndex < args.length; argIndex++) {
      const arg = args[argIndex];
      const param = overload.params[paramIndex];
      if (param === undefined) {
        ok = false;
        break;
      }
      const argOk = param.allowedTypes.some(paramT => {
        // Check whether types match (allowing for nullability errors, expression type errors,
        // eval space errors, and unknown types due to prior errors in args)
        const {dataTypeMatch, genericsSet} = isDataTypeMatch(
          genericsSelected,
          overload.genericTypes ?? [],
          arg,
          paramT
        );
        for (const genericSet of genericsSet) {
          genericsSelected.set(genericSet.name, genericSet.type);
        }
        // Check expression type errors
        if (paramT.expressionType) {
          const expressionTypeMatch = isExpressionTypeLEQ(
            arg.expressionType,
            paramT.expressionType
          );
          if (!expressionTypeMatch) {
            expressionTypeErrors.push({
              argIndex,
              maxExpressionType: paramT.expressionType,
              actualExpressionType: arg.expressionType,
              param,
            });
          }
        }
        // Check eval space errors
        if (
          // Error if literal is required but arg is not literal
          (paramT.evalSpace === 'literal' && arg.evalSpace !== 'literal') ||
          // Error if constant is required but arg is input/output
          (paramT.evalSpace === 'constant' &&
            (arg.evalSpace === 'input' || arg.evalSpace === 'output')) ||
          // Error if output is required but arg is input
          // TODO: Assumption that calculations cannot take input things
          (expressionIsAnalytic(overload.returnType.expressionType) &&
            arg.evalSpace === 'input')
        ) {
          evalSpaceErrors.push({
            argIndex,
            param,
            maxEvalSpace: paramT.evalSpace,
            actualEvalSpace: arg.evalSpace,
          });
        }
        // Check nullability errors. For now we only require that literal arguments must be
        // non-null, but in the future we may allow parameters to say whether they can accept literal
        // nulls.
        if (paramT.evalSpace === 'literal' && arg.type === 'null') {
          nullabilityErrors.push({
            argIndex,
            param,
          });
        }
        return dataTypeMatch;
      });
      if (!argOk) {
        ok = false;
        break;
      }
      if (param.isVariadic) {
        if (argIndex === args.length - 1) {
          matchedVariadic = true;
        }
      } else {
        paramIndex++;
      }
    }
    if (
      !matchedVariadic &&
      (paramIndex !== args.length || paramIndex !== overload.params.length)
    ) {
      continue;
    }
    const resolveReturnType = resolveGenerics(
      overload.returnType,
      genericsSelected
    );
    const returnType = resolveReturnType.returnType ?? {type: 'number'};
    if (ok) {
      return {
        overload,
        expressionTypeErrors,
        evalSpaceErrors,
        nullabilityErrors,
        returnTypeError: resolveReturnType.error,
        returnType,
      };
    }
  }
}

type InterpolationPart =
  | {type: 'string'; value: string}
  | {type: 'interpolation'; path: string[]};

function parseSQLInterpolation(template: string): InterpolationPart[] {
  const parts: InterpolationPart[] = [];
  let remaining = template;
  while (remaining.length) {
    const nextInterp = remaining.indexOf('${');
    if (nextInterp === -1) {
      parts.push({type: 'string', value: remaining});
      break;
    } else {
      const interpEnd = remaining.slice(nextInterp).indexOf('}');
      if (interpEnd === -1) {
        parts.push({type: 'string', value: remaining});
        break;
      }
      if (nextInterp > 0) {
        parts.push({type: 'string', value: remaining.slice(0, nextInterp)});
      }
      parts.push({
        type: 'interpolation',
        path: remaining
          .slice(nextInterp + 2, interpEnd + nextInterp)
          .split('.'),
      });
      remaining = remaining.slice(interpEnd + nextInterp + 1);
    }
  }
  return parts;
}

type GenericAssignment = {name: string; type: ExpressionValueTypeDef};

function isDataTypeMatch(
  genericsAlreadySelected: Map<string, ExpressionValueTypeDef>,
  genericTypes: {name: string; acceptibleTypes: FunctionGenericTypeDef[]}[],
  arg: ExpressionValueTypeDef,
  paramT: FunctionGenericTypeDef | FunctionParameterTypeDef
): {
  dataTypeMatch: boolean;
  genericsSet: GenericAssignment[];
} {
  if (
    TD.eq(paramT, arg) ||
    paramT.type === 'any' ||
    // TODO We should consider whether `nulls` should always be allowed. It probably
    // does not make sense to limit function calls to not allow nulls, since have
    // so little control over nullability.
    (paramT.type !== 'generic' && (arg.type === 'null' || arg.type === 'error'))
  ) {
    return {dataTypeMatch: true, genericsSet: []};
  }
  if (paramT.type === 'array' && arg.type === 'array') {
    if (isBasicArray(arg)) {
      if (!isRepeatedRecordFunctionParam(paramT)) {
        return isDataTypeMatch(
          genericsAlreadySelected,
          genericTypes,
          arg.elementTypeDef,
          paramT.elementTypeDef
        );
      } else {
        return {dataTypeMatch: false, genericsSet: []};
      }
    } else if (isRepeatedRecordFunctionParam(paramT)) {
      const fakeParamRecord: RecordFunctionParameterTypeDef = {
        type: 'record',
        fields: paramT.fields,
      };
      const fakeArgRecord: RecordTypeDef = {
        type: 'record',
        fields: arg.fields,
      };
      return isDataTypeMatch(
        genericsAlreadySelected,
        genericTypes,
        fakeArgRecord,
        fakeParamRecord
      );
    } else {
      return {dataTypeMatch: false, genericsSet: []};
    }
  } else if (paramT.type === 'record' && arg.type === 'record') {
    const genericsSet: GenericAssignment[] = [];
    const paramFieldsByName = new Map<string, FunctionParameterFieldDef>();
    for (const field of paramT.fields) {
      paramFieldsByName.set(field.as ?? field.name, field);
    }
    for (const field of arg.fields) {
      const match = paramFieldsByName.get(field.as ?? field.name);
      if (match === undefined) {
        return {dataTypeMatch: false, genericsSet: []};
      }
      const result = isDataTypeMatch(
        new Map([
          ...genericsAlreadySelected.entries(),
          ...genericsSet.map(
            x => [x.name, x.type] as [string, ExpressionValueTypeDef]
          ),
        ]),
        genericTypes,
        field,
        match
      );
      genericsSet.push(...result.genericsSet);
    }
    return {dataTypeMatch: true, genericsSet};
  } else if (paramT.type === 'generic') {
    const alreadySelected = genericsAlreadySelected.get(paramT.generic);
    if (
      alreadySelected !== undefined &&
      alreadySelected.type !== 'null' &&
      alreadySelected.type !== 'error'
    ) {
      return isDataTypeMatch(
        genericsAlreadySelected,
        genericTypes,
        arg,
        alreadySelected
      );
    }
    const allowedTypes =
      genericTypes.find(t => t.name === paramT.generic)?.acceptibleTypes ?? [];
    for (const type of allowedTypes) {
      const result = isDataTypeMatch(
        genericsAlreadySelected,
        genericTypes,
        arg,
        type
      );
      if (result.dataTypeMatch) {
        if (!isAtomic(arg) && arg.type !== 'null') {
          continue;
        }
        const newGenericSet: GenericAssignment = {
          name: paramT.generic,
          type: arg,
        };
        return {
          dataTypeMatch: true,
          genericsSet: [...result.genericsSet, newGenericSet],
        };
      }
    }
  }
  return {dataTypeMatch: false, genericsSet: []};
}

function resolveGenerics(
  returnType:
    | FunctionReturnTypeDesc
    | Exclude<FunctionReturnTypeDef, RecordFunctionReturnTypeDef>,
  genericsSelected: Map<string, ExpressionValueTypeDef>
):
  | {error: undefined; returnType: ExpressionValueTypeDef}
  | {error: AnyMessageCodeAndParameters; returnType: undefined} {
  switch (returnType.type) {
    case 'array': {
      if ('fields' in returnType) {
        const fields = returnType.fields.map(f => {
          const type = resolveGenerics(f, genericsSelected);
          return {
            ...f,
            ...type,
          };
        });
        return {
          error: undefined,
          returnType: {
            type: 'array',
            elementTypeDef: returnType.elementTypeDef,
            fields,
          },
        };
      }
      const resolve = resolveGenerics(
        returnType.elementTypeDef,
        genericsSelected
      );
      if (resolve.error) {
        return resolve;
      }
      const elementTypeDef = resolve.returnType;
      if (elementTypeDef.type === 'record') {
        return {
          error: undefined,
          returnType: {
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            fields: elementTypeDef.fields,
          },
        };
      }
      if (!isAtomic(elementTypeDef)) {
        return {
          error: {
            code: 'invalid-resolved-type-for-array',
            parameters: 'Invalid resolved type for array; cannot be non-atomic',
          },
          returnType: undefined,
        };
      }
      return {
        error: undefined,
        returnType: {type: 'array', elementTypeDef},
      };
    }
    case 'record': {
      const fields = returnType.fields.map(f => {
        const type = resolveGenerics(f, genericsSelected);
        return {
          ...f,
          ...type,
        };
      });
      return {error: undefined, returnType: {type: 'record', fields}};
    }
    case 'generic': {
      const resolved = genericsSelected.get(returnType.generic);
      if (resolved === undefined) {
        return {
          error: {
            code: 'generic-not-resolved',
            parameters: `Generic ${returnType.generic} in return type could not be resolved`,
          },
          returnType: undefined,
        };
      }
      return {
        error: undefined,
        returnType: resolved,
      };
    }
    default:
      return {error: undefined, returnType};
  }
}
