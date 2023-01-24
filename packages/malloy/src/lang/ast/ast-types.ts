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
  AtomicFieldType,
  Fragment,
  TimestampUnit,
  NamedModelObject,
  TimeFieldType,
  ExpressionType,
  ModelDef,
  Query,
  SQLBlockStructDef,
} from "../../model/malloy_types";
import { ModelDataRequest } from "../parse-malloy";

// These are the types which a field expression will evaluate to
export type ExpressionValueType =
  | AtomicFieldType
  | "null"
  | "unknown"
  | "duration"
  | "regular expression";

export type StageFieldType = "turtle";

// And these are the other field value types
export type FieldValueType = ExpressionValueType | StageFieldType | "struct";

export interface FragType {
  dataType: FieldValueType;
  expressionType: ExpressionType;
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
      good.expressionType === checkThis.expressionType
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
        if (type.expressionType != "scalar") {
          inspected = `${type.expressionType} ${inspected}`;
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
  return { dataType: dType, expressionType: "scalar" };
}

export type ExprValue = ExprResult | GranularResult;

export interface ExprResult extends FragType {
  value: Fragment[];
}

export interface TimeResult extends ExprResult {
  dataType: TimeFieldType;
  alsoTimestamp?: true;
}

export interface GranularResult extends TimeResult {
  timeframe: TimestampUnit;
}

// export type Comparison = "~" | "!~" | "<" | "<=" | "=" | ">" | ">=" | "!=";

// export type Equality = "~" | "!~" | "=" | "!=";

export enum Equality {
  Like = "~",
  NotLike = "!~",
  Equals = "=",
  NotEquals = "!=",
}

export enum Comparison {
  Like = "~",
  NotLike = "!~",
  LessThan = "<",
  LessThanOrEqualTo = "<=",
  EqualTo = "=",
  GreaterThan = ">",
  GreaterThanOrEqualTo = ">=",
  NotEqualTo = "!=",
}

export interface ModelEntry {
  entry: NamedModelObject;
  exported?: boolean;
  sqlType?: boolean;
}
export interface NameSpace {
  getEntry(name: string): ModelEntry | undefined;
  setEntry(name: string, value: ModelEntry, exported: boolean): void;
}

export interface DocumentCompileResult {
  modelDef: ModelDef;
  queryList: Query[];
  sqlBlocks: SQLBlockStructDef[];
  needs: ModelDataRequest;
}

export interface FieldType {
  type: FieldValueType;
  expressionType?: ExpressionType;
}

export class TypeMismatch extends Error {}

export abstract class SpaceEntry {
  abstract type(): FieldType;
  abstract refType: "field" | "parameter";
}

interface LookupFound {
  found: SpaceEntry;
  error: undefined;
}
interface LookupError {
  error: string;
  found: undefined;
}
export type LookupResult = LookupFound | LookupError;
