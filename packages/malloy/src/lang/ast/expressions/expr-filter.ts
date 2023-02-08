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

import { expressionIsCalculation } from "../../../model/malloy_types";

import { errorFor } from "../ast-utils";
import { FT } from "../fragtype-utils";
import { Filter } from "../query-properties/filters";
import { ExprValue } from "../types/expr-value";
import { ExpressionDef } from "../types/expression-def";
import { FieldSpace } from "../types/field-space";

export class ExprFilter extends ExpressionDef {
  elementType = "filtered expression";
  legalChildTypes = FT.anyAtomicT;
  constructor(readonly expr: ExpressionDef, readonly filter: Filter) {
    super({ "expr": expr, "filter": filter });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const testList = this.filter.getFilterList(fs);
    const resultExpr = this.expr.getExpression(fs);
    for (const cond of testList) {
      if (expressionIsCalculation(cond.expressionType)) {
        this.filter.log(
          "Cannot filter a field with an aggregate or analytical computation"
        );
        return errorFor("no filter on aggregate");
      }
    }
    if (resultExpr.expressionType === "scalar") {
      // TODO could log a warning, but I have a problem with the
      // idea of warnings, so for now ...
      return resultExpr;
    }
    if (
      this.typeCheck(this.expr, { ...resultExpr, "expressionType": "scalar" })
    ) {
      return {
        ...resultExpr,
        "value": [
          {
            "type": "filterExpression",
            "e": resultExpr.value,
            "filterList": testList
          }
        ]
      };
    }
    this.expr.log(`Cannot filter '${resultExpr.dataType}' data`);
    return errorFor("cannot filter type");
  }
}
