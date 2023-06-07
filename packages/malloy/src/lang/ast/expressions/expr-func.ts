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
  expressionIsScalar,
  ExpressionType,
  FieldValueType,
  Fragment,
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

  getExpression(fs: FieldSpace): ExprValue {
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
      return {
        dataType: 'unknown',
        expressionType: 'scalar',
        value: [],
        evalSpace: 'constant',
      };
    } else if (func.type !== 'function') {
      this.log(`Cannot call '${this.name}', which is of type ${func.type}`);
      return {
        dataType: 'unknown',
        expressionType: 'scalar',
        value: [],
        evalSpace: 'constant',
      };
    }
    let implicitExpr: ExprValue | undefined = undefined;
    let structPath = this.source?.refString;
    if (this.source) {
      const sourceFoot = this.source.getField(fs).found;
      if (sourceFoot) {
        const footType = sourceFoot.typeDesc();
        if (isAtomicFieldType(footType.dataType)) {
          implicitExpr = {
            dataType: footType.dataType,
            expressionType: footType.expressionType,
            value: [{type: 'field', path: this.source.refString}],
            evalSpace: footType.evalSpace,
          };
          structPath = this.source.sourceString;
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
      return {
        dataType: 'unknown',
        expressionType: 'scalar',
        value: [],
        evalSpace: 'constant',
      };
    }
    const {overload, expressionTypeErrors, evalSpaceErrors} = result;
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
      return {
        dataType: 'unknown',
        expressionType,
        value: [],
        evalSpace: 'constant',
      };
    }
    const funcCall: Expr = [
      {
        type: 'function_call',
        overload,
        args: argExprs.map(x => x.value),
        expressionType,
        structPath,
      },
    ];
    if (type.dataType === 'any') {
      this.log(
        `Invalid return type ${type.dataType} for function '${this.name}'`
      );
      return {
        dataType: 'unknown',
        expressionType,
        value: [],
        evalSpace: 'constant',
      };
    }
    const maxEvalSpace = mergeEvalSpaces(...argExprs.map(e => e.evalSpace));
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

function findOverload(
  func: FunctionDef,
  args: ExprValue[]
):
  | {
      overload: FunctionOverloadDef;
      expressionTypeErrors: ExpressionTypeError[];
      evalSpaceErrors: EvalSpaceError[];
    }
  | undefined {
  for (const overload of func.overloads) {
    let paramIndex = 0;
    let ok = true;
    let matchedVariadic = false;
    const expressionTypeErrors: ExpressionTypeError[] = [];
    const evalSpaceErrors: EvalSpaceError[] = [];
    for (let argIndex = 0; argIndex < args.length; argIndex++) {
      const arg = args[argIndex];
      const param = overload.params[paramIndex];
      if (param === undefined) {
        ok = false;
        break;
      }
      const argOk = param.allowedTypes.some(paramT => {
        const dataTypeMatch =
          paramT.dataType === arg.dataType ||
          paramT.dataType === 'any' ||
          // TODO We should consider whether `nulls` should always be allowed. It probably
          // does not make sense to limit function calls to not allow nulls, since have
          // so little control over nullability.
          arg.dataType === 'null' ||
          // TODO I've included this because it means that errors cascade a bit less...
          // I think we may want to add an `error` type for nodes generated from errors,
          // then make `error` propagate without generating more errors.
          arg.dataType === 'unknown';
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
        if (
          (paramT.evalSpace === 'literal' && arg.evalSpace !== 'literal') ||
          (paramT.evalSpace === 'constant' &&
            (arg.evalSpace === 'input' || arg.evalSpace === 'output')) ||
          (paramT.evalSpace === 'output' && arg.evalSpace === 'input')
        ) {
          evalSpaceErrors.push({
            argIndex,
            param,
            maxEvalSpace: paramT.evalSpace,
            actualEvalSpace: arg.evalSpace,
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
      return {overload, expressionTypeErrors, evalSpaceErrors};
    }
  }
}
