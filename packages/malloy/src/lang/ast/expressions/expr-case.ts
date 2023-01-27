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

import { errorFor } from "../ast-utils";
import { ExprValue } from "../compound-types/expr-value";
import { FieldSpace } from "../field-space";
import { FT } from "../fragtype-utils";
import { FragType } from "../type-interfaces/frag-type";
import { ExpressionDef } from "./expression-def";
import { WhenClause } from "./when-clause";

export class ExprCase extends ExpressionDef {
  elementType = "case statement";
  constructor(
    readonly when: WhenClause[],
    readonly elseClause?: ExpressionDef
  ) {
    super({ when });
    this.has({ elseClause });
  }

  getExpression(fs: FieldSpace): ExprValue {
    let retType: FragType | undefined;
    let expressionType: ExpressionType = "scalar";
    const caseExpr: Fragment[] = ["CASE "];
    for (const clause of this.when) {
      const whenExpr = clause.whenThis.getExpression(fs);
      const thenExpr = clause.thenThis.getExpression(fs);
      expressionType = maxExpressionType(
        expressionType,
        maxExpressionType(whenExpr.expressionType, thenExpr.expressionType)
      );
      if (thenExpr.dataType !== "null") {
        if (retType && !FT.typeEq(retType, thenExpr)) {
          this.log(
            `Mismatched THEN clause types, ${FT.inspect(retType, thenExpr)}`
          );
          return errorFor("then typecheck");
        } else {
          retType = thenExpr;
        }
      }
      caseExpr.push("WHEN ", ...whenExpr.value, " THEN ", ...thenExpr.value);
    }
    if (this.elseClause) {
      const elseExpr = this.elseClause.getExpression(fs);
      expressionType = maxExpressionType(
        expressionType,
        elseExpr.expressionType
      );
      caseExpr.push(" ELSE ", ...elseExpr.value);
      if (elseExpr.dataType !== "null") {
        if (retType && !FT.typeEq(retType, elseExpr)) {
          this.log(
            `Mismatched ELSE clause type, ${FT.inspect(retType, elseExpr)}`
          );
          return errorFor("else typecheck");
        } else {
          retType = elseExpr;
        }
      }
    }
    if (retType === undefined) {
      this.log("case statement type not computable");
      return errorFor("typeless case");
    }
    caseExpr.push(" END");
    return {
      dataType: retType.dataType,
      expressionType,
      value: caseExpr,
    };
  }
}
