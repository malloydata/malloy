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
  EvalSpace,
  Expr,
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsScalar,
  ExpressionType,
  FieldValueType,
  Fragment,
  FunctionCallFragment,
  FunctionDef,
  FunctionOverloadDef,
  FunctionParameterDef,
  isAtomicFieldType,
  isExpressionTypeLEQ,
  maxExpressionType,
  maxOfExpressionTypes,
  mergeEvalSpaces,
} from '../../../model/malloy_types';
import {errorFor} from '../ast-utils';
import {StructSpaceFieldBase} from '../field-space/struct-space-field-base';

import {FieldReference} from '../query-items/field-references';
import {AggregateOrdering} from '../query-properties/aggregate-ordering';
import {Limit} from '../query-properties/limit';
import {PartitionBy} from '../query-properties/partition_by';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {compressExpr} from './utils';

export class ExprFunc extends ExpressionDef {
  elementType = 'function call()';
  constructor(
    readonly name: string,
    readonly args: ExpressionDef[],
    readonly isRaw: boolean,
    readonly rawType: FieldValueType | undefined,
    readonly source?: FieldReference
  ) {
    super({args: args});
    this.has({source: source});
  }

  getExpression(fs: FieldSpace) {
    return this.getPropsExpression(fs);
  }

  getPropsExpression(
    fs: FieldSpace,
    props?: {
      partitionBy?: PartitionBy;
      orderBy?: AggregateOrdering;
      limit?: Limit;
    }
  ): ExprValue {
    const argExprsWithoutImplicit = this.args.map(arg => arg.getExpression(fs));
    if (this.isRaw) {
      let expressionType: ExpressionType = 'scalar';
      let collectType: FieldValueType | undefined;
      const funcCall: Fragment[] = [`${this.name}(`];
      for (const expr of argExprsWithoutImplicit) {
        expressionType = maxExpressionType(expressionType, expr.expressionType);

        if (collectType) {
          funcCall.push(',');
        } else {
          collectType = expr.dataType;
        }
        funcCall.push(...expr.value);
      }
      funcCall.push(')');

      const dataType = this.rawType ?? collectType ?? 'number';
      return {
        dataType,
        expressionType,
        value: compressExpr(funcCall),
        evalSpace: mergeEvalSpaces(
          ...argExprsWithoutImplicit.map(e => e.evalSpace)
        ),
      };
    }

    // TODO this makes functions case-insensitive. This is weird that this is the only place
    // where case insensitivity is thing.
    const func = this.modelEntry(this.name.toLowerCase())?.entry;
    if (func === undefined) {
      this.log(
        `Unknown function '${this.name}'. Use '${this.name}!(...)' to call a SQL function directly.`
      );
      return errorFor('unknown function');
    } else if (func.type !== 'function') {
      this.log(`Cannot call '${this.name}', which is of type ${func.type}`);
      return errorFor('called non function');
    }
    if (func.name !== this.name) {
      this.log(
        `Case insensitivity for function names is deprecated, use '${func.name}' instead`,
        'warn'
      );
    }
    // Find the 'implicit argument' for aggregate functions called like `some_join.some_field.agg(...args)`
    // where the full arg list is `(some_field, ...args)`.
    let implicitExpr: ExprValue | undefined = undefined;
    let structPath = this.source?.path;
    if (this.source) {
      const sourceFoot = this.source.getField(fs).found;
      if (sourceFoot) {
        const footType = sourceFoot.typeDesc();
        if (isAtomicFieldType(footType.dataType)) {
          implicitExpr = {
            dataType: footType.dataType,
            expressionType: footType.expressionType,
            value: [{type: 'field', path: this.source.path}],
            evalSpace: footType.evalSpace,
          };
          structPath = this.source.path.slice(0, -1);
        } else {
          if (!(sourceFoot instanceof StructSpaceFieldBase)) {
            const message = `Aggregate source cannot be a ${footType.dataType}`;
            this.log(message);
            return errorFor(message);
          }
        }
      } else {
        const message = `Reference to undefined value ${this.source.refString}`;
        this.log(message);
        return errorFor(message);
      }
    }
    // Construct the full args list including the implicit arg.
    const argExprs = [
      ...(implicitExpr ? [implicitExpr] : []),
      ...argExprsWithoutImplicit,
    ];
    const result = findOverload(func, argExprs);
    if (result === undefined) {
      this.log(
        `No matching overload for function ${this.name}(${argExprs
          .map(e => e.dataType)
          .join(', ')})`
      );
      return errorFor('no matching overload');
    }
    const {overload, expressionTypeErrors, evalSpaceErrors, nullabilityErrors} =
      result;
    // Report errors for expression type mismatch
    for (const error of expressionTypeErrors) {
      const adjustedIndex = error.argIndex - (implicitExpr ? 1 : 0);
      const allowed = expressionIsScalar(error.maxExpressionType)
        ? 'scalar'
        : 'scalar or aggregate';
      const arg = this.args[adjustedIndex];
      arg.log(
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
      arg.log(
        `Parameter ${error.argIndex + 1} ('${error.param.name}') of ${
          this.name
        } must be ${allowed}, but received ${error.actualEvalSpace}`
      );
    }
    // Report nullability errors
    for (const error of nullabilityErrors) {
      const adjustedIndex = error.argIndex - (implicitExpr ? 1 : 0);
      const arg = this.args[adjustedIndex];
      arg.log(
        `Parameter ${error.argIndex + 1} ('${error.param.name}') of ${
          this.name
        } must not be a literal null`
      );
    }
    const type = overload.returnType;
    const expressionType = maxOfExpressionTypes([
      type.expressionType,
      ...argExprs.map(e => e.expressionType),
    ]);
    if (
      !expressionIsAggregate(overload.returnType.expressionType) &&
      this.source !== undefined
    ) {
      this.log(
        `Cannot call function ${this.name}(${argExprs
          .map(e => e.dataType)
          .join(', ')}) with source`
      );
      return errorFor('cannot call with source');
    }
    const frag: FunctionCallFragment = {
      type: 'function_call',
      overload,
      args: argExprs.map(x => x.value),
      expressionType,
      structPath,
    };
    let funcCall: Expr = [frag];
    const dialect = fs.dialectObj()?.name;
    const dialectOverload = dialect ? overload.dialect[dialect] : undefined;
    // TODO add in an error if you use an asymmetric function in BQ
    // and the function uses joins
    // TODO add in an error if you use an illegal join pattern
    if (dialectOverload === undefined) {
      this.log(`Function ${this.name} is not defined in dialect ${dialect}`);
    } else {
      if (props?.orderBy) {
        if (
          dialectOverload.supportsOrderBy ||
          expressionIsAnalytic(overload.returnType.expressionType)
        ) {
          const ob = props.orderBy.getAggregateOrderBy(fs);
          frag.orderBy = ob;
        } else {
          props.orderBy.log(`Function ${this.name} does not support order_by`);
        }
      }
      if (props?.limit !== undefined) {
        if (dialectOverload.supportsLimit) {
          frag.limit = props.limit.limit;
        } else {
          this.log(`Function ${this.name} does not support limit`);
        }
      }
    }
    if (props?.partitionBy) {
      const partitionBy: string[] = [];
      for (const partitionField of props.partitionBy.partitionFields) {
        const e = partitionField.getField(fs);
        if (e.found === undefined) {
          partitionField.log(`${partitionField.refString} is not defined`);
        } else if (expressionIsScalar(e.found.typeDesc().expressionType)) {
          partitionBy.push(partitionField.nameString);
        } else {
          partitionField.log('Partition expression must be scalar');
        }
      }
      frag.partitionBy = partitionBy;
    }
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
        return errorFor(
          `Cannot use sql_function \`${func.name}\`; use \`sql_functions\` experiment to enable this behavior`
        );
      }

      const str = argExprs[0].value;
      if (
        str.length !== 1 ||
        typeof str[0] === 'string' ||
        str[0].type !== 'dialect' ||
        str[0].function !== 'stringLiteral'
      ) {
        this.log(`Invalid string literal for \`${func.name}\``);
      } else {
        const literal = str[0].literal;
        const parts = parseSQLInterpolation(literal);
        const unsupportedInterpolations = parts
          .filter(
            part => part.type === 'interpolation' && part.name.includes('.')
          )
          .map(unsupportedPart =>
            unsupportedPart.type === 'interpolation'
              ? `\${${unsupportedPart.name}}`
              : `\${${unsupportedPart.value}}`
          );

        if (unsupportedInterpolations.length > 0) {
          const unsupportedInterpolationMsg =
            unsupportedInterpolations.length === 1
              ? `'.' paths are not yet supported in sql interpolations, found ${unsupportedInterpolations.at(
                  0
                )}`
              : `'.' paths are not yet supported in sql interpolations, found [${unsupportedInterpolations.join(
                  ', '
                )}]`;
          this.log(unsupportedInterpolationMsg);

          return errorFor(
            `${unsupportedInterpolationMsg}. See LookML \${...} documentation at https://cloud.google.com/looker/docs/reference/param-field-sql#sql_for_dimensions`
          );
        }

        funcCall = [
          {
            type: 'sql-string',
            e: parts.map(part =>
              part.type === 'string'
                ? part.value
                : part.name === 'TABLE'
                ? {type: 'source-reference'}
                : {type: 'field', path: [part.name]}
            ),
          },
        ];
      }
    }
    if (type.dataType === 'any') {
      this.log(
        `Invalid return type ${type.dataType} for function '${this.name}'`
      );
      return errorFor('invalid return type');
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
    return {
      dataType: type.dataType,
      expressionType,
      value: compressExpr(funcCall),
      evalSpace,
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
    }
  | undefined {
  for (const overload of func.overloads) {
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
        const dataTypeMatch =
          paramT.dataType === arg.dataType ||
          paramT.dataType === 'any' ||
          // TODO We should consider whether `nulls` should always be allowed. It probably
          // does not make sense to limit function calls to not allow nulls, since have
          // so little control over nullability.
          arg.dataType === 'null' ||
          arg.dataType === 'error';
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
          (paramT.evalSpace === 'output' && arg.evalSpace === 'input')
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
        if (paramT.evalSpace === 'literal' && arg.dataType === 'null') {
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
    if (ok) {
      return {
        overload,
        expressionTypeErrors,
        evalSpaceErrors,
        nullabilityErrors,
      };
    }
  }
}

type InterpolationPart =
  | {type: 'string'; value: string}
  | {type: 'interpolation'; name: string};

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
        name: remaining.slice(nextInterp + 2, interpEnd + nextInterp),
      });
      remaining = remaining.slice(interpEnd + nextInterp + 1);
    }
  }
  return parts;
}
