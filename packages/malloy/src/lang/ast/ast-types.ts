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

import {
  AtomicFieldType,
  Fragment,
  isAtomicFieldType,
  TimestampUnit,
  Expr,
  TimeFieldType,
} from "../../model/malloy_types";

// These are the types which a field expression will evaluate to
export type ExpressionValueType =
  | AtomicFieldType
  | "null"
  | "unknown"
  | "duration"
  | "regular expression";

export function isExpressionValueType(
  fv: FieldValueType
): fv is ExpressionValueType {
  return (
    isAtomicFieldType(fv) ||
    ["null", "unknown", "duration", "regular expression"].includes(fv)
  );
}

export type StageFieldType = "turtle";

// And these are the other field value types
export type FieldValueType = ExpressionValueType | StageFieldType | "struct";

export interface FragType {
  dataType: FieldValueType;
  aggregate: boolean;
}

/**
 * Collects functions which operate on fragtype compatible objects
 */
export class FT {
  /**
   * Checks if a given type is in a list
   * @param check The type to check (can be undefined)
   * @param from List of types which are OK
   */
  static in(check: FragType | undefined, from: FragType[]): boolean {
    if (check) {
      const found = from.find((okType) => FT.eq(okType, check));
      return found !== undefined;
    }
    return false;
  }

  /**
   * Checks if a possibly undefined candidate matches a type
   * @param good The real type
   * @param checkThis The possibly undefined candidate
   */
  static eq(good: FragType, checkThis: FragType | undefined): boolean {
    return (
      checkThis !== undefined &&
      good.dataType === checkThis.dataType &&
      good.aggregate === checkThis.aggregate
    );
  }

  /**
   * Checks if the base types, ignoring aggregate, are equal
   * @param left Left type
   * @param right Right type
   * @param nullOk True if a NULL is an acceptable match
   */
  static typeEq(left: FragType, right: FragType, nullOk = false): boolean {
    const maybeEq = left.dataType === right.dataType;
    const nullEq =
      nullOk && (left.dataType === "null" || right.dataType === "null");
    return maybeEq || nullEq;
  }

  /**
   *
   * For error messages, returns a comma seperated list of readable names
   * for a list of types.
   * @param types List of type or objects with types
   */
  static inspect(...types: (FragType | undefined)[]): string {
    const strings = types.map((type) => {
      if (type) {
        let inspected: string = type.dataType;
        if (type.aggregate) {
          inspected = `aggregate ${inspected}`;
        }
        return inspected;
      }
      return "undefined";
    });
    return strings.join(",");
  }

  static nullT = mkFragType("null");
  static numberT = mkFragType("number");
  static stringT = mkFragType("string");
  static dateT = mkFragType("date");
  static timestampT = mkFragType("timestamp");
  static boolT = mkFragType("boolean");
  static anyAtomicT = [
    FT.numberT,
    FT.stringT,
    FT.dateT,
    FT.timestampT,
    FT.boolT,
  ];
}

function mkFragType(dType: FieldValueType): FragType {
  return { dataType: dType, aggregate: false };
}

export type ExprValue = ExprResult | GranularResult;

export interface ExprResult extends FragType {
  value: Fragment[];
}

export interface GranularResult extends ExprResult {
  dataType: TimeFieldType;
  timeframe: TimestampUnit;
  alsoTimestamp?: true;
}
export function isGranularResult(v: ExprValue): v is GranularResult {
  if (v.dataType !== "date" && v.dataType !== "timestamp") {
    return false;
  }
  return (v as GranularResult).timeframe !== undefined;
}
export function granularity(t: TimestampUnit): number {
  const granularityMap: Record<string, number> = {
    microsecond: -2,
    millisecond: -1,
    second: 1,
    minute: 2,
    hour: 3,
    day: 4,
    date: 4,
    week: 5,
    month: 6,
    quarter: 7,
    year: 8,
  };

  return granularityMap[t] || granularityMap.millisecond;
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
    aggregate: false,
    value: [`_ERROR_${reason.replace(/ /g, "_")}`],
  };
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

export function compressExpr(expr: Expr): Expr {
  // compress all adjacent strings
  const compressValue = [];
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

export type Comparison = "~" | "!~" | "<" | "<=" | "=" | ">" | ">=" | "!=";
export function isComparison(s: string): s is Comparison {
  return ["~", "!~", "<", "<=", "=", ">", ">=", "!="].includes(s);
}
export type Equality = "~" | "!~" | "=" | "!=";
export function isEquality(s: string): s is Equality {
  return ["~", "!~", "=", "!="].includes(s);
}
