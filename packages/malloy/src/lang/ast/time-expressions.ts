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
  isDateUnit,
  isTimeFieldType,
  maxExpressionType,
  mkExpr,
  TimeFieldType,
  TimestampUnit
} from "../../model/malloy_types";

import { errorFor } from "./ast-utils";
import { ExprValue } from "./compound-types/expr-value";
import { ExpressionDef } from "./expressions/expression-def";
import { compose, compressExpr } from "./expressions/utils";
import { FieldSpace } from "./field-space";
import { FT } from "./fragtype-utils";
import { timeOffset } from "./time-utils";
import { GranularResult } from "./type-interfaces/granular-result";

export class ExprTime extends ExpressionDef {
  elementType = "timestampOrDate";
  readonly translationValue: ExprValue;
  constructor(
    timeType: TimeFieldType,
    value: Fragment[] | string,
    expressionType: ExpressionType = "scalar"
  ) {
    super();
    this.elementType = timeType;
    this.translationValue = {
      dataType: timeType,
      expressionType,
      value: typeof value === "string" ? [value] : value,
    };
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.translationValue;
  }

  static fromValue(timeType: TimeFieldType, expr: ExprValue): ExprTime {
    let value = expr.value;
    if (timeType != expr.dataType) {
      const toTs: Fragment = {
        type: "dialect",
        function: "cast",
        safe: false,
        dstType: timeType,
        expr: expr.value,
      };
      if (isTimeFieldType(expr.dataType)) {
        toTs.srcType = expr.dataType;
      }
      value = compressExpr([toTs]);
    }
    return new ExprTime(timeType, value, expr.expressionType);
  }
}

/**
 * GranularTime is a moment in time which ALSO has a "granularity"
 * commonly this are created by applying ".datePart" to an expression
 * 1) They have a value, which is the moment in time
 * 2) When used in a comparison, they act like a range, for the
 *    duration of 1 unit of granularity
 */
export class ExprGranularTime extends ExpressionDef {
  elementType = "granularTime";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(
    readonly expr: ExpressionDef,
    readonly units: TimestampUnit,
    readonly truncate: boolean
  ) {
    super({ expr });
  }

  granular(): boolean {
    return true;
  }

  getExpression(fs: FieldSpace): ExprValue {
    const timeframe = this.units;
    const exprVal = this.expr.getExpression(fs);
    if (isTimeFieldType(exprVal.dataType)) {
      const tsVal: GranularResult = {
        ...exprVal,
        dataType: exprVal.dataType,
        timeframe: timeframe,
      };
      if (this.truncate) {
        tsVal.value = [
          {
            type: "dialect",
            function: "trunc",
            expr: { value: exprVal.value, valueType: exprVal.dataType },
            units: timeframe,
          },
        ];
      }
      return tsVal;
    }
    this.log(`Cannot do time truncation on type '${exprVal.dataType}'`);
    return errorFor(`granularity typecheck`);
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const rangeType = this.getExpression(fs).dataType;
    const _valueType = left.getExpression(fs).dataType;
    const granularityType = isDateUnit(this.units) ? "date" : "timestamp";

    if (rangeType == "date" && granularityType == "date") {
      return this.dateRange(fs, op, left);
    }
    return this.timestampRange(fs, op, left);

    /*
      write tests for each of these cases ....

      vt  rt  gt  use
      dt  dt  dt  dateRange
      dt  dt  ts  == or timeStampRange
      dt  ts  dt  timestampRange
      dt  ts  ts  timeStampRange

      ts  ts  ts  timestampRange
      ts  ts  dt  timestampRange
      ts  dt  ts  timestampRange
      ts  dt  dt  either

    */
  }

  protected timestampRange(
    fs: FieldSpace,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    const begin = this.getExpression(fs);
    const beginTime = ExprTime.fromValue("timestamp", begin);
    const endTime = new ExprTime(
      "timestamp",
      timeOffset("timestamp", begin.value, "+", mkExpr`1`, this.units),
      begin.expressionType
    );
    const range = new Range(beginTime, endTime);
    return range.apply(fs, op, expr);
  }

  protected dateRange(
    fs: FieldSpace,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    const begin = this.getExpression(fs);
    const beginTime = new ExprTime("date", begin.value, begin.expressionType);
    const endAt = timeOffset("date", begin.value, "+", ["1"], this.units);
    const end = new ExprTime("date", endAt, begin.expressionType);
    const range = new Range(beginTime, end);
    return range.apply(fs, op, expr);
  }
}

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
          dataType: "boolean",
          expressionType: maxExpressionType(
            fromValue.expressionType,
            toValue.expressionType
          ),
          value: compose(fromValue.value, op2, toValue.value),
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
