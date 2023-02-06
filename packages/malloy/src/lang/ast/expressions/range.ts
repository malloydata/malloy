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

import { maxExpressionType } from "../../../model/malloy_types";

import { errorFor } from "../ast-utils";
import { ExprValue } from "../types/expr-value";
import { ExpressionDef } from "../types/expression-def";
import { compose } from "./utils";
import { FieldSpace } from "../types/field-space";

export class Range extends ExpressionDef {
  elementType = "range";
  constructor(readonly first: ExpressionDef, readonly last: ExpressionDef) {
    super({ first, last });
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    switch (op) {
      case "=":
      case "!=": {
        const op1 = op === "=" ? ">=" : "<";
        const op2 = op === "=" ? "and" : "or";
        const op3 = op === "=" ? "<" : ">=";
        const fromValue = this.first.apply(fs, op1, expr);
        const toValue = this.last.apply(fs, op3, expr);
        return {
          "dataType": "boolean",
          "expressionType": maxExpressionType(
            fromValue.expressionType,
            toValue.expressionType
          ),
          "value": compose(fromValue.value, op2, toValue.value)
        };
      }

      /**
       * This is a little surprising, but is actually how you comapre a
       * value to a range ...
       *
       * val > begin to end     val >= end
       * val >= begin to end    val >= begin
       * val < begin to end     val < begin
       * val <= begin to end    val < end
       */
      case ">":
        return this.last.apply(fs, ">=", expr);
      case ">=":
        return this.first.apply(fs, ">=", expr);
      case "<":
        return this.first.apply(fs, "<", expr);
      case "<=":
        return this.last.apply(fs, "<", expr);
    }
    throw new Error("mysterious error in range computation");
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return errorFor("a range is not a value");
  }
}
