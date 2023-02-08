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

import { castTo } from "../time-utils";
import { ExprValue } from "../types/expr-value";
import { ExpressionDef } from "../types/expression-def";
import { FieldSpace } from "../types/field-space";
import { compressExpr } from "./utils";

export type CastType = "string" | "number" | "boolean" | "date" | "timestamp";
export function isCastType(t: string): t is CastType {
  return ["string", "number", "boolean", "date", "timestamp"].includes(t);
}

export class ExprCast extends ExpressionDef {
  elementType = "cast";
  constructor(
    readonly expr: ExpressionDef,
    readonly castType: CastType,
    readonly safe = false
  ) {
    super({ "expr": expr });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const expr = this.expr.getExpression(fs);
    return {
      "dataType": this.castType,
      "expressionType": expr.expressionType,
      "value": compressExpr(castTo(this.castType, expr.value, this.safe))
    };
  }
}
