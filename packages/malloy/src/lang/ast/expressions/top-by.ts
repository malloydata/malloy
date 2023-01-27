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
import { By, expressionIsAggregate } from "../../../model/malloy_types";
import { compressExpr } from "../ast-utils";
import { FieldSpace } from "../field-space";
import { MalloyElement } from "../malloy-element";
import { ExpressionDef } from "./expression-def";

export class TopBy extends MalloyElement {
  elementType = "topBy";
  constructor(readonly by: string | ExpressionDef) {
    super();
    if (by instanceof ExpressionDef) {
      this.has({ by });
    }
  }

  getBy(fs: FieldSpace): By {
    if (this.by instanceof ExpressionDef) {
      const byExpr = this.by.getExpression(fs);
      if (!expressionIsAggregate(byExpr.expressionType)) {
        this.log("top by expression must be an aggregate");
      }
      return { by: "expression", e: compressExpr(byExpr.value) };
    }
    return { by: "name", name: this.by };
  }
}
