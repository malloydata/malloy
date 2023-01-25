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

import { Comparison, Equality } from "./ast-types";
import { FieldValueType } from "./compound-types/field-value-type";
import { GranularResult } from "./type-interfaces/granular-result";
import { ExpressionValueType } from "./compound-types/expression-value-type";
import { ExprValue } from "./compound-types/expr-value";
import {
  Expr,
  Fragment,
  isAtomicFieldType,
  TimestampUnit,
} from "../../model/malloy_types";

export function isEquality(s: string): s is Equality {
  return Object.values(Equality).includes(s as Equality);
}

export function isComparison(s: string): s is Comparison {
  return Object.values(Comparison).includes(s as Comparison);
}

/**
 * Compose a binary expression. Tries to write them safely and concisely
 * @param left
 * @param op
 * @param right
 * @returns Fragment list of the composed expression
 */
export function compose(
  left: Fragment[],
  op: string,
  right: Fragment[]
): Fragment[] {
  const opAlpha = op.match(/^[A-Za-z]/);
  const leftSpace = left.length === 1 && opAlpha ? " " : "";
  const rightSpace = right.length === 1 && opAlpha ? " " : "";
  const newOp = leftSpace + op + rightSpace;
  return [...term(left), newOp, ...term(right)];
}

/**
 * If the passed expresion is not a single term, wrap it in parens
 * @param f expression fragment
 */
function term(f: Fragment[]): Fragment[] {
  if (f.length > 1) {
    return ["(", ...f, ")"];
  }
  if (f.length === 0) {
    // Trying to compose a binary expresion with an entity that has no value
    // this should at least cause the generated SQL to error, but likely
    // there has already been a semantic error reported.
    return ["__MISSING_VALUE__"];
  }
  return f;
}

export function isExpressionValueType(
  fv: FieldValueType
): fv is ExpressionValueType {
  return (
    isAtomicFieldType(fv) ||
    ["null", "unknown", "duration", "regular expression"].includes(fv)
  );
}

/**
 * When a translation hits an error, log and return one of these as a value.
 * This will allow the rest of the translation walk to complete. The
 * generated SQL will have a reference to an impossible variable name
 * with the reason embedded in it.
 * @param reason very short phrase, only read by implementers
 * @returns Fragment[] which a debugging humnan will regognize
 */
export function errorFor(reason: string): ExprValue {
  return {
    dataType: "unknown",
    expressionType: "scalar",
    value: [`_ERROR_${reason.replace(/ /g, "_")}`],
  };
}

export function compressExpr(expr: Expr): Expr {
  // compress all adjacent strings
  const compressValue: Array<string | Fragment> = [];
  let buildString;
  for (const fragment of expr.flat()) {
    if (typeof fragment === "string") {
      buildString = buildString ? buildString + fragment : fragment;
    } else {
      if (buildString) {
        compressValue.push(buildString);
        buildString = undefined;
      }
      compressValue.push(fragment);
    }
  }
  if (buildString) {
    compressValue.push(buildString);
  }

  return compressValue;
}

export function dateOffset(
  from: Fragment[],
  op: "+" | "-",
  n: Fragment[],
  timeframe: TimestampUnit
): Fragment[] {
  const add = op === "+" ? "_ADD" : "_SUB";
  const units = timeframe.toUpperCase();
  return compressExpr([
    `DATE${add}(`,
    ...from,
    `,INTERVAL `,
    ...n,
    ` ${units})`,
  ]);
}

export function timestampOffset(
  from: Fragment[],
  op: "+" | "-",
  n: Fragment[],
  timeframe: TimestampUnit,
  fromNotTimestamp = false
): Fragment[] {
  const useDatetime = ["week", "month", "quarter", "year"].includes(timeframe);
  const add = op === "+" ? "_ADD" : "_SUB";
  const units = timeframe.toUpperCase();
  if (useDatetime) {
    return [
      `TIMESTAMP(DATETIME${add}(DATETIME(`,
      ...from,
      `),INTERVAL `,
      ...n,
      ` ${units}))`,
    ];
  }
  const typeFrom = fromNotTimestamp ? ["TIMESTAMP(", ...from, ")"] : from;
  return compressExpr([
    `TIMESTAMP${add}(`,
    ...typeFrom,
    `,INTERVAL `,
    ...n,
    ` ${units})`,
  ]);
}

export function isGranularResult(v: ExprValue): v is GranularResult {
  if (v.dataType !== "date" && v.dataType !== "timestamp") {
    return false;
  }
  return (v as GranularResult).timeframe !== undefined;
}
