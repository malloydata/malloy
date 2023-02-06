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
  AggregateFragment,
  isAtomicFieldType,
} from "../../../model/malloy_types";
import { errorFor } from "../ast-utils";
import { ExprValue } from "../types/expr-value";
import { FieldValueType } from "../types/type-desc";
import { FieldReference } from "../query-items/field-references";
import { FieldSpace } from "../types/field-space";
import { FT } from "../fragtype-utils";
import { StructSpaceFieldBase } from "../field-space/struct-space-field-base";
import { ExpressionDef } from "../types/expression-def";

export abstract class ExprAggregateFunction extends ExpressionDef {
  elementType: string;
  source?: FieldReference;
  expr?: ExpressionDef;
  legalChildTypes = [FT.numberT];
  constructor(readonly func: string, expr?: ExpressionDef) {
    super();
    this.elementType = func;
    if (expr) {
      this.expr = expr;
      this.has({ expr });
    }
  }

  returns(_forExpression: ExprValue): FieldValueType {
    return "number";
  }

  getExpression(fs: FieldSpace): ExprValue {
    let exprVal = this.expr?.getExpression(fs);
    let structPath = this.source?.refString;
    if (this.source) {
      const sourceFoot = this.source.getField(fs).found;
      if (sourceFoot) {
        const footType = sourceFoot.type();
        if (isAtomicFieldType(footType.type)) {
          exprVal = {
            dataType: footType.type,
            expressionType: footType.expressionType || "scalar",
            value: [{ type: "field", path: this.source.refString }],
          };
          structPath = this.source.sourceString;
        } else {
          if (!(sourceFoot instanceof StructSpaceFieldBase)) {
            this.log(`Aggregate source cannot be a ${footType.type}`);
            return errorFor(`Aggregate source cannot be a ${footType.type}`);
          }
        }
      } else {
        this.log(`Reference to undefined value ${this.source.refString}`);
        return errorFor(
          `Reference to undefined value ${this.source.refString}`
        );
      }
    }
    if (exprVal === undefined) {
      this.log("Missing expression for aggregate function");
      return errorFor("agggregate without expression");
    }
    if (
      this.typeCheck(this.expr || this, {
        ...exprVal,
        expressionType: "scalar",
      })
    ) {
      const f: AggregateFragment = {
        type: "aggregate",
        function: this.func,
        e: exprVal.value,
      };
      if (structPath) {
        f.structPath = structPath;
      }
      return {
        dataType: this.returns(exprVal),
        expressionType: "aggregate",
        value: [f],
      };
    }
    return errorFor("aggregate type check");
  }
}
