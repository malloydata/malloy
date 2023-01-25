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
import { ExpressionValueType } from "./compound-types/expression-value-type";

export type StageFieldType = "turtle";

// And these are the other field value types
export type FieldValueType = ExpressionValueType | StageFieldType | "struct";

export interface FragType {
  dataType: FieldValueType;
  expressionType: ExpressionType;
}

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

export type FieldMap = Record<string, SpaceEntry>;

interface LookupFound {
  found: SpaceEntry;
  error: undefined;
}
interface LookupError {
  error: string;
  found: undefined;
}
export type LookupResult = LookupFound | LookupError;
