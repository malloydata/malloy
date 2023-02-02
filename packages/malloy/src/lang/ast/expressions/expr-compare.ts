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

import { Comparison } from "../types/comparison";
import { FieldSpace } from "../types/field-space";
import { ExprGranularTime } from "./expr-granular-time";
import { isGranularResult } from "../types/granular-result";
import { compareTypes } from "../types/compart-types";
import { ExprValue } from "../types/expr-value";
import { ExpressionDef } from "../types/expression-def";
import { BinaryBoolean } from "./binary-boolean";

export class ExprCompare extends BinaryBoolean<Comparison> {
  elementType = "a<=>b";
  constructor(left: ExpressionDef, op: Comparison, right: ExpressionDef) {
    super(left, op, right);
    this.legalChildTypes = compareTypes[op];
  }

  getExpression(fs: FieldSpace): ExprValue {
    if (!this.right.granular()) {
      const rhs = this.right.requestExpression(fs);
      if (rhs && isGranularResult(rhs)) {
        const newRight = new ExprGranularTime(this.right, rhs.timeframe, false);
        return newRight.apply(fs, this.op, this.left);
      }
    }

    return this.right.apply(fs, this.op, this.left);
  }
}
