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
  isTimeFieldType,
  Expr,
  mkExpr,
  DivFragment,
  maxExpressionType,
} from "../../model/malloy_types";
import { FieldSpace } from "../field-space";
import { ExprDuration } from "./ast-time-expr";
import {
  ExprValue,
  FieldValueType,
  isComparison,
  isGranularResult,
  errorFor,
  isEquality,
  Equality,
  compose,
} from "./ast-types";
import { ExpressionDef, TypeMistmatch } from "./ast-expr";
import { castTimestampToDate } from "./time-utils";

/**
 * All of the magic of malloy expressions eventually flows to here,
 * where an operator is applied to two values. Depending on the
 * operator and value types this may involve transformations of
 * the values or even the operator.
 * @param fs FieldSpace for the symbols
 * @param left Left value
 * @param op The operator
 * @param right Right Value
 * @returns ExprValue of the expression
 */
export function applyBinary(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  if (isEquality(op)) {
    return equality(fs, left, op, right);
  }
  if (isComparison(op)) {
    return compare(fs, left, op, right);
  }
  if (oneOf(op, "+", "-")) {
    return delta(fs, left, op, right);
  }
  if (oneOf(op, "*", "%")) {
    return numeric(fs, left, op, right);
  }
  if (oneOf(op, "/")) {
    const num = left.getExpression(fs);
    const denom = right.getExpression(fs);

    if (num.dataType != "number") {
      left.log("Numerator for division must be a number");
    } else if (denom.dataType != "number") {
      right.log("Denominator for division must be a number");
    } else {
      const div: DivFragment = {
        type: "dialect",
        function: "div",
        numerator: num.value,
        denominator: denom.value,
      };
      return {
        dataType: "number",
        expressionType: maxExpressionType(
          num.expressionType,
          denom.expressionType
        ),
        value: [div],
      };
    }
    return errorFor("divide type mismatch");
  }
  left.log(`Canot use ${op} operator here`);
  return errorFor("applybinary bad operator");
}
function oneOf(op: string, ...operators: string[]): boolean {
  return operators.includes(op);
}

function allAre(oneType: FieldValueType, ...values: ExprValue[]): boolean {
  for (const v of values) {
    if (v.dataType !== oneType) {
      return false;
    }
  }
  return true;
}

function regexEqual(left: ExprValue, right: ExprValue): Expr | undefined {
  if (left.dataType === "string") {
    if (right.dataType === "regular expression") {
      return [
        {
          type: "dialect",
          function: "regexpMatch",
          expr: left.value,
          regexp: (right.value[0] as string).replace(/^r'/, "'"),
        },
      ];
    }
  } else if (right.dataType === "string") {
    if (left.dataType === "regular expression") {
      return [
        {
          type: "dialect",
          function: "regexpMatch",
          expr: right.value,
          regexp: (left.value[0] as string).replace(/^r'/, "'"),
        },
      ];
    }
  }
  return undefined;
}

function nullCompare(
  left: ExprValue,
  op: string,
  right: ExprValue
): Expr | undefined {
  const not = op === "!=" || op === "!~";
  if (left.dataType === "null" || right.dataType === "null") {
    const maybeNot = not ? " NOT" : "";
    if (left.dataType !== "null") {
      return [...left.value, ` IS${maybeNot} NULL`];
    }
    if (right.dataType !== "null") {
      return [...right.value, `IS${maybeNot} NULL`];
    }
    return [not ? "false" : "true"];
  }
  return undefined;
}

function timeCompare(
  lhs: ExprValue,
  op: string,
  rhs: ExprValue
): Expr | undefined {
  if (isTimeFieldType(lhs.dataType) && isTimeFieldType(rhs.dataType)) {
    if (lhs.dataType !== rhs.dataType) {
      let lval = lhs.value;
      let rval = rhs.value;
      if (lhs.dataType === "timestamp") {
        lval = castTimestampToDate(lval);
      } else {
        rval = castTimestampToDate(rval);
      }
      return compose(lval, op, rval);
    }
  }
  return undefined;
}

export function nullsafeNot(expr: Expr, op?: Equality): Expr {
  if (op === undefined || op === "!=" || op === "!~") {
    return mkExpr`COALESCE(NOT(${expr}),FALSE)`;
  }
  return expr;
}

function equality(
  fs: FieldSpace,
  left: ExpressionDef,
  op: Equality,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  let value = timeCompare(lhs, op, rhs) || compose(lhs.value, op, rhs.value);

  if (lhs.dataType != "unknown" && rhs.dataType != "unknown") {
    switch (op) {
      case "~":
      case "!~": {
        if (lhs.dataType === "string" && rhs.dataType === "string") {
          value = compose(lhs.value, "LIKE", rhs.value);
        } else {
          const regexCmp = regexEqual(lhs, rhs);
          if (regexCmp === undefined) {
            throw new TypeMistmatch(
              "Incompatible types for match('~') operator"
            );
          }
          value = regexCmp;
        }
        value = nullsafeNot(value, op);
        break;
      }
      case "=":
      case "!=": {
        const nullCmp = nullCompare(lhs, op, rhs);
        if (nullCmp) {
          value = nullCmp;
        } else {
          value = nullsafeNot(
            regexEqual(lhs, rhs) || compose(lhs.value, "=", rhs.value),
            op
          );
        }
        break;
      }
    }
  }

  return {
    dataType: "boolean",
    expressionType: maxExpressionType(lhs.expressionType, rhs.expressionType),
    value,
  };
}

function compare(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  const expressionType = maxExpressionType(
    lhs.expressionType,
    rhs.expressionType
  );
  const value = timeCompare(lhs, op, rhs) || compose(lhs.value, op, rhs.value);

  return {
    dataType: "boolean",
    expressionType,
    value: value,
  };
}

function numeric(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);
  const expressionType = maxExpressionType(
    lhs.expressionType,
    rhs.expressionType
  );

  if (allAre("number", lhs, rhs)) {
    return {
      dataType: "number",
      expressionType,
      value: compose(lhs.value, op, rhs.value),
    };
  }

  left.log(`Non numeric('${lhs.dataType},${rhs.dataType}') value with '${op}'`);
  return errorFor("numbers required");
}

function delta(
  fs: FieldSpace,
  left: ExpressionDef,
  op: string,
  right: ExpressionDef
): ExprValue {
  const lhs = left.getExpression(fs);
  const rhs = right.getExpression(fs);

  if (isTimeFieldType(lhs.dataType)) {
    let duration: ExpressionDef = right;
    if (rhs.dataType !== "duration") {
      if (isGranularResult(lhs)) {
        duration = new ExprDuration(right, lhs.timeframe);
      } else if (lhs.dataType === "date") {
        duration = new ExprDuration(right, "day");
      } else {
        left.log(`Can not offset time by '${rhs.dataType}'`);
        return errorFor(`time plus ${rhs.dataType}`);
      }
    }
    return duration.apply(fs, op, left);
  }
  return numeric(fs, left, op, right);
}
