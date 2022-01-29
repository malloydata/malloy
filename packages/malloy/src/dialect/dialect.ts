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

interface DialectField {
  type: string;
  sqlExpression: string;
  sqlOutputName: string;
}

export type DialectFieldList = DialectField[];

const dateTimeframes = ["day", "week", "month", "quarter", "year"];
export type DateTimeframe = typeof dateTimeframes[number];

const timestampTimeframes = [...dateTimeframes, "hour", "minute", "second"];
export type TimestampTimeframe = typeof timestampTimeframes[number];

export function isDateTimeframe(t: TimestampTimeframe): t is DateTimeframe {
  return dateTimeframes.indexOf(t) != -1;
}

const extractDateTimeframes = [
  "DAY_OF_WEEK",
  "DAY",
  "DAY_OF_YEAR",
  "WEEK",
  "MONTH",
  "QUARTER",
  "YEAR",
  "HOUR",
  "HOURS",
  "MINUTE",
  "MINUTES",
  "SECOND",
  "SECOND",
];

export type ExtractDateTimeframe = typeof extractDateTimeframes[number];

export type DialectExpr = (string | unknown)[];

export abstract class Dialect {
  abstract name: string;
  abstract defaultNumberType: string;
  abstract udfPrefix: string;
  abstract hasFinalStage: boolean;
  abstract stringTypeName: string;
  abstract divisionIsInteger: boolean;

  // return a quoted string for use as a table name.
  abstract quoteTableName(tableName: string): string;

  // returns an table that is a 0 based array of numbers
  abstract sqlGroupSetTable(groupSetCount: number): string;

  // aggregate function that return the ANY NON NULL value encountered
  abstract sqlAnyValue(groupSet: number, fieldName: string): string;

  // can array agg or any_value a struct...
  abstract sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string;

  abstract sqlAnyValueTurtle(
    groupSet: number,
    fieldList: DialectFieldList
  ): string;

  abstract sqlAnyValueLastTurtle(name: string, sqlName: string): string;

  abstract sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string;

  abstract sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean
  ): string;

  abstract sqlSumDistinctHashedKey(sqlDistinctKey: string): string;

  abstract sqlGenerateUUID(): string;

  abstract sqlFieldReference(
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean
  ): string;

  abstract sqlUnnestPipelineHead(): string;

  abstract sqlCreateFunction(id: string, funcText: string): string;

  abstract sqlCreateFunctionCombineLastStage(lastStageName: string): string;
  abstract sqlCreateTableAsSelect(tableName: string, sql: string): string;

  abstract sqlSelectAliasAsStruct(alias: string): string;

  sqlFinalStage(_lastStageName: string): string {
    throw new Error("Dialect has no final Stage but called Anyway");
  }

  // default implementation will probably work most of the time
  sqlDateToString(sqlDateExp: string): string {
    return `CAST(DATE(${sqlDateExp}) AS ${this.stringTypeName} )`;
  }
  abstract sqlMaybeQuoteIdentifier(identifier: string): string;

  // date truncation
  abstract sqlDateTrunc(expr: unknown, timeframe: DateTimeframe): DialectExpr;

  // Timestamp truncation
  abstract sqlTimestampTrunc(
    expr: unknown,
    timeframe: TimestampTimeframe,
    timezone: string
  ): DialectExpr;

  abstract sqlExtractDateTimeframe(
    expr: unknown,
    timeframe: ExtractDateTimeframe
  ): DialectExpr;

  abstract sqlDateCast(expr: unknown): DialectExpr;

  abstract sqlTimestampCast(expr: unknown): DialectExpr;

  abstract sqlDateAdd(
    op: "+" | "-",
    expr: unknown,
    n: unknown,
    timeframe: DateTimeframe
  ): DialectExpr;

  abstract sqlTimestampAdd(
    op: "+" | "-",
    expr: unknown,
    n: unknown,
    timeframe: DateTimeframe
  ): DialectExpr;
}
