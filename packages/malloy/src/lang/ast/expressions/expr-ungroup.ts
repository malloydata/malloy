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
  expressionIsAggregate,
  UngroupFragment,
} from "../../../model/malloy_types";

import { QuerySpace } from "../ast-main";
import { errorFor } from "../ast-utils";
import { ExprValue } from "../compound-types/expr-value";
import { FieldValueType } from "../compound-types/field-value-type";
import { DefSpace } from "../field-declaration";
import { FieldName, FieldSpace } from "../field-space";
import { FT } from "../fragtype-utils";
import { ExpressionDef } from "./expression-def";

export class ExprUngroup extends ExpressionDef {
  legalChildTypes = FT.anyAtomicT;
  elementType = "ungroup";
  constructor(
    readonly control: "all" | "exclude",
    readonly expr: ExpressionDef,
    readonly fields: FieldName[]
  ) {
    super({ expr, fields });
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return "number";
  }

  getExpression(fs: FieldSpace): ExprValue {
    const exprVal = this.expr.getExpression(fs);
    if (!expressionIsAggregate(exprVal.expressionType)) {
      this.expr.log(`${this.control}() expression must be an aggregate`);
      return errorFor("ungrouped scalar");
    }
    const ungroup: UngroupFragment = { type: this.control, e: exprVal.value };
    if (this.typeCheck(this.expr, { ...exprVal, expressionType: "scalar" })) {
      if (this.fields.length > 0) {
        let qs = fs;
        if (fs instanceof DefSpace) {
          qs = fs.realFS;
        }
        if (!(qs instanceof QuerySpace)) {
          this.log(
            `${this.control}() must be in a query -- weird internal error`
          );
          return errorFor("ungroup query check");
        }
        const output = qs.result;
        const dstFields: string[] = [];
        const isExclude = this.control == "exclude";
        for (const mustBeInOutput of this.fields) {
          output.whenComplete(() => {
            output.checkUngroup(mustBeInOutput, isExclude);
          });
          dstFields.push(mustBeInOutput.refString);
        }
        ungroup.fields = dstFields;
      }
      return {
        dataType: this.returns(exprVal),
        expressionType: "analytic",
        value: [ungroup],
      };
    }
    this.log(`${this.control}() incompatible type`);
    return errorFor("ungrouped type check");
  }
}
