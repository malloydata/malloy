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
  Expr,
  Fragment,
  isAtomicFieldType,
  mkExpr,
} from "../../../model/malloy_types";

import { Equality } from "../types/equality";
import { ExprValue } from "../types/expr-value";
import { ExpressionValueType } from "../types/expression-value-type";
import { FieldValueType } from "../types/field-value-type";

export function isExpressionValueType(
  fv: FieldValueType
): fv is ExpressionValueType {
  return (
    isAtomicFieldType(fv) ||
    ["null", "unknown", "duration", "regular expression"].includes(fv)
  );
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

export function nullsafeNot(expr: Expr, op?: Equality): Expr {
  if (op === undefined || op === "!=" || op === "!~") {
    return mkExpr`COALESCE(NOT(${expr}),FALSE)`;
  }
  return expr;
}
