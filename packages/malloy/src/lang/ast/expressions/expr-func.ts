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
  ExpressionType,
  Fragment,
  maxExpressionType,
} from "../../../model/malloy_types";

import { ExprValue } from "../types/expr-value";
import { FieldValueType } from "../types/type-desc";
import { FieldSpace } from "../types/field-space";
import { ExpressionDef } from "../types/expression-def";
import { compressExpr } from "./utils";

export class ExprFunc extends ExpressionDef {
  elementType = "function call()";
  constructor(readonly name: string, readonly args: ExpressionDef[]) {
    super({ args });
  }

  getExpression(fs: FieldSpace): ExprValue {
    let expressionType: ExpressionType = "scalar";
    let collectType: FieldValueType | undefined;
    const funcCall: Fragment[] = [`${this.name}(`];
    for (const fexpr of this.args) {
      const expr = fexpr.getExpression(fs);
      expressionType = maxExpressionType(expressionType, expr.expressionType);

      if (collectType) {
        funcCall.push(",");
      } else {
        collectType = expr.dataType;
      }
      funcCall.push(...expr.value);
    }
    funcCall.push(")");

    const dialect = fs.dialectObj();
    const dataType =
      dialect?.getFunctionInfo(this.name)?.returnType ??
      collectType ??
      "number";
    return {
      "dataType": dataType,
      expressionType,
      "value": compressExpr(funcCall),
    };
  }
}
