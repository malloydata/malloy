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
  FunctionDef,
  FunctionOverloadDef,
  isExpressionTypeLEQ,
  maxOfExpressionTypes
} from "../../../model/malloy_types";

import { ExprValue } from "../types/expr-value";
import { ExpressionDef } from "../types/expression-def";
import { FieldSpace } from "../types/field-space";
import { compressExpr } from "./utils";

export class ExprFunc extends ExpressionDef {
  elementType = "function call()";
  constructor(readonly name: string, readonly args: ExpressionDef[]) {
    super({ "args": args });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const func = this.modelEntry(this.name)?.entry;
    if (func === undefined) {
      this.log(`Unknown function '${this.name}'. Did you mean to import it?`);
      return {
        "dataType": "unknown",
        "expressionType": "scalar",
        "value": []
      };
    } else if (func.type !== "function") {
      this.log(`Cannot call '${this.name}', which is of type ${func.type}`);
      return {
        "dataType": "unknown",
        "expressionType": "scalar",
        "value": []
      };
    }
    const argExprs = this.args.map((arg) => arg.getExpression(fs));
    const overload = findOverload(func, argExprs);
    if (overload === undefined) {
      this.log(
        `No matching overload for function ${this.name}(${argExprs
          .map((e) => e.dataType)
          .join(", ")})`
      );
      return {
        "dataType": "unknown",
        "expressionType": "scalar",
        "value": []
      };
    }
    const funcCall: Expr = [
      {
        "type": "function_call",
        overload,
        "args": argExprs.map((x) => x.value)
      }
    ];

    const type = overload.returnType;
    const expressionType = maxOfExpressionTypes([
      type.expressionType,
      ...argExprs.map((e) => e.expressionType)
    ]);
    if (type.dataType == "any") {
      this.log(
        `Invalid return type ${type.dataType} for function '${this.name}'`
      );
      return {
        "dataType": "unknown",
        expressionType,
        "value": []
      };
    }
    return {
      "dataType": type.dataType,
      expressionType,
      "value": compressExpr(funcCall)
    };
  }
}

function findOverload(
  func: FunctionDef,
  args: ExprValue[]
): FunctionOverloadDef | undefined {
  for (const overload of func.overloads) {
    let paramIndex = 0;
    let ok = true;
    for (let argIndex = 0; argIndex < args.length; argIndex++) {
      const arg = args[argIndex];
      const param = overload.params[paramIndex];
      if (param === undefined) {
        ok = false;
        break;
      }
      const argOk = param.allowedTypes.some((param) => {
        const dataTypeMatch =
          param.dataType == arg.dataType ||
          param.dataType == "any" ||
          // TODO not sure about this -- but prevents cascading errors...
          arg.dataType == "unknown";
        const expressionTypeMatch = isExpressionTypeLEQ(
          arg.expressionType,
          param.expressionType
        );
        return dataTypeMatch && expressionTypeMatch;
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
      return overload;
    }
  }
}
