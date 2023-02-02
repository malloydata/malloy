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

import { AggregateFragment } from "../../../model/malloy_types";

import { ExprValue } from "../types/expr-value";
import { FieldReference } from "../query-items/field-references";
import { FieldSpace } from "../types/field-space";
import { ExprAggregateFunction } from "./expr-aggregate-function";

export class ExprCount extends ExprAggregateFunction {
  elementType = "count";
  constructor(readonly source?: FieldReference) {
    super("count");
    this.has({ source });
  }

  defaultFieldName(): string | undefined {
    if (this.source) {
      return "count_" + this.source.nameString;
    }
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const ret: AggregateFragment = {
      type: "aggregate",
      function: "count",
      e: [],
    };
    if (this.source) {
      ret.structPath = this.source.refString;
    }
    return {
      dataType: "number",
      expressionType: "aggregate",
      value: [ret],
    };
  }
}
