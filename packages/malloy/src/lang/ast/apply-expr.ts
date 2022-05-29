/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { isTimeFieldType, Expr, mkExpr } from "../../model/malloy_types";
import { FieldSpace } from "../field-space";
import {
  ExprDuration,
  ExprValue,
  ExpressionDef,
  FieldValueType,
  isComparison,
  isGranularResult,
  TypeMistmatch,
  errorFor,
  isEquality,
  Equality,
  compose,
  castTimestampToDate,
} from "./index";

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
  if (oneOf(op, "*")) {
    return numeric(fs, left, op, right);
  }
  if (oneOf(op, "/")) {
    if (fs.getDialect().divisionIsInteger) {
      return numeric(fs, left, "*1.0/", right);
    } else {
      return numeric(fs, left, op, right);
    }
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
    aggregate: lhs.aggregate || rhs.aggregate,
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
  const anyAggregate = lhs.aggregate || rhs.aggregate;
  const value = timeCompare(lhs, op, rhs) || compose(lhs.value, op, rhs.value);

  return {
    dataType: "boolean",
    aggregate: anyAggregate,
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
  const anyAggregate = lhs.aggregate || rhs.aggregate;

  if (allAre("number", lhs, rhs)) {
    return {
      dataType: "number",
      aggregate: anyAggregate,
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
