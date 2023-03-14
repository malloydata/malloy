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
  Expr,
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
    if (this.isRaw) {
      let expressionType: ExpressionType = 'scalar';
      let collectType: FieldValueType | undefined;
      const funcCall: Fragment[] = [`${this.name}(`];
      for (const fexpr of this.args) {
        const expr = fexpr.getExpression(fs);
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
        // TODO
        dataType: dataType as any,
        expressionType,
        value: compressExpr(funcCall),
      };
    }

    const func = this.modelEntry(this.name.toLowerCase())?.entry;
    if (func === undefined) {
      this.log(`Unknown function '${this.name}'. Did you mean to import it?`);
      return {
        dataType: 'unknown',
        expressionType: 'scalar',
        value: [],
      };
    } else if (func.type !== 'function') {
      this.log(`Cannot call '${this.name}', which is of type ${func.type}`);
      return {
        dataType: 'unknown',
        expressionType: 'scalar',
        value: [],
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
    const argExprsWithoutImplicit = this.args.map(arg => arg.getExpression(fs));
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
      };
    }
    const {overload, expressionTypeErrors} = result;
    if (expressionTypeErrors.length > 0) {
      for (const error of expressionTypeErrors) {
        const adjustedIndex = error.argIndex - (implicitExpr ? 1 : 0);
        const allowed =
          error.maxExpressionType === 'scalar'
            ? 'scalar'
            : 'scalar or aggregate';
        const arg = this.args[adjustedIndex];
        arg.log(
          `Parameter ${error.param.name} of ${this.name} must be ${allowed}, but received ${error.actualExpressionType}`
        );
      }
    }
    const type = overload.returnType;
    const expressionType = maxOfExpressionTypes([
      type.expressionType,
      ...argExprs.map(e => e.expressionType),
    ]);
    if (
      overload.returnType.expressionType === 'scalar' &&
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
      };
    }
    return {
      dataType: type.dataType,
      expressionType,
      value: compressExpr(funcCall),
    };
  }
}

type ExpressionTypeError = {
  argIndex: number;
  actualExpressionType: ExpressionType;
  maxExpressionType: ExpressionType;
  param: FunctionParameterDef;
};

function findOverload(
  func: FunctionDef,
  args: ExprValue[]
):
  | {
      overload: FunctionOverloadDef;
      expressionTypeErrors: ExpressionTypeError[];
    }
  | undefined {
  for (const overload of func.overloads) {
    let paramIndex = 0;
    let ok = true;
    const expressionTypeErrors: ExpressionTypeError[] = [];
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
          // TODO I've included this because it means that errors cascade a bit less...
          // I think we may want to add an `error` type for nodes generated from errors,
          // then make `error` propagate without generating more errors.
          arg.dataType === 'unknown';
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
        return dataTypeMatch;
      });
      if (!argOk) {
        ok = false;
        break;
      }
      if (param.isVariadic) {
        if (argIndex === args.length - 1) {
          paramIndex = args.length;
        }
      } else {
        paramIndex++;
      }
    }
    if (paramIndex !== args.length) {
      continue;
    }
    if (ok) {
      return {overload, expressionTypeErrors};
    }
  }
}
