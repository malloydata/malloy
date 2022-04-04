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

import { DateTime } from "luxon";
import {
  Expr,
  Fragment,
  isTimeTimeframe,
  TimeTimeframe,
} from "../../model/malloy_types";
import { FieldSpace } from "../field-space";
import {
  dateOffset,
  timestampOffset,
  resolution,
  toTimestampV,
} from "./time-utils";
import {
  ExpressionDef,
  BinaryBoolean,
  Range,
  ExprTime,
  ExprValue,
  errorFor,
  isGranularResult,
  GranularResult,
  granularity,
  FT,
  isTimeType,
  TimeType,
  compressExpr,
  FieldValueType,
  MalloyElement,
  Comparison,
} from "./index";

export class Timeframe extends MalloyElement {
  elementType = "timeframe";
  readonly text: TimeTimeframe;
  constructor(timeframeName: string) {
    super();
    let tf = timeframeName.toLowerCase();
    if (tf.endsWith("s")) {
      tf = tf.slice(0, -1);
    }
    this.text = isTimeTimeframe(tf) ? tf : "second";
  }
}

/**
 * GranularTime is a moment in time which ALSO has a "granularity"
 * commonly this are created by applying ".datePart" to an expression
 * 1) They have a value, which is the moment in time
 * 2) When used in a comparison, they act like a range, for the
 *    duration of 1 unit of granularity
 */
abstract class GranularTime extends ExpressionDef {
  elementType = "granularAbstract";
  constructor(readonly units: TimeTimeframe) {
    super();
  }

  granular(): boolean {
    return true;
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const lhs = this.getExpression(fs);
    const rhs = left.getExpression(fs);

    // Comparing to a granular value with equality, the granular value
    // is treated like a range
    if (rhs.dataType === "timestamp" && lhs.dataType === "timestamp") {
      return this.timestampRange(fs, op, left);
    }
    return this.dateRange(fs, op, left);
  }

  protected timestampRange(
    fs: FieldSpace,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    let beginAt = this.getExpression(fs);
    if (beginAt.dataType !== "timestamp") {
      beginAt = {
        ...beginAt,
        dataType: "timestamp",
        value: compressExpr(["TIMESTAMP(", ...beginAt.value, ")"]),
      };
    }
    const begin = new ExprTime("timestamp", beginAt.value, beginAt.aggregate);
    const timeframe = this.units;
    const endAt = timestampOffset(
      fs.getDialect(),
      beginAt.value,
      "+",
      ["1"],
      timeframe
    );
    const end = new ExprTime("timestamp", endAt, beginAt.aggregate);
    const range = new Range(begin, end);
    return range.apply(fs, op, expr);
  }

  protected dateRange(
    fs: FieldSpace,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    if (["year", "quarter", "month", "week", "day"].includes(this.units)) {
      let beginAt = this.getExpression(fs);
      if (beginAt.dataType !== "date") {
        beginAt = {
          ...beginAt,
          dataType: "date",
          value: compressExpr(
            fs.getDialect().sqlDateCast(beginAt.value) as Expr
          ),
        };
      }
      const begin = new ExprTime("date", beginAt.value, beginAt.aggregate);
      const endAt = dateOffset(
        fs.getDialect(),
        beginAt.value,
        "+",
        ["1"],
        this.units
      );
      const end = new ExprTime("date", endAt, beginAt.aggregate);
      const range = new Range(begin, end);
      return range.apply(fs, op, expr);
    }
    this.log(`Date cannot have granularity of '${this.units}'`);
    return errorFor("truncated date range");
  }
}

export class ExprGranularTime extends GranularTime {
  elementType = "granularTime";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(
    readonly expr: ExpressionDef,
    units: TimeTimeframe,
    readonly truncate: boolean
  ) {
    super(units);
    this.has({ expr });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const timeframe = this.units;
    const exprVal = this.expr.getExpression(fs);
    if (isTimeType(exprVal.dataType)) {
      const tsVal: GranularResult = {
        ...exprVal,
        dataType: exprVal.dataType,
        timeframe: timeframe,
        value: exprVal.value,
      };
      if (this.truncate) {
        if (exprVal.dataType === "date") {
          tsVal.value = compressExpr(
            fs.getDialect().sqlDateTrunc(exprVal.value, timeframe) as Expr
          );
        } else {
          tsVal.value = compressExpr(
            fs
              .getDialect()
              .sqlTimestampTrunc(exprVal.value, timeframe, "UTC") as Expr
          );
        }
      }
      return tsVal;
    }
    this.log(`Cannot do time truncaiton on type '${exprVal.dataType}'`);
    return errorFor(`granularity typecheck`);
  }
}

/**
 * GranularTime made from a literal. Funky because it doesn't know if it
 * is a date or a timestamp in many cases until it is applied.
 */
export class GranularLiteral extends ExpressionDef {
  elementType = "timeLiteral";
  timeType?: TimeType;

  constructor(
    readonly moment: string,
    readonly until: string,
    readonly units: TimeTimeframe
  ) {
    super();
  }

  granular(): boolean {
    return true;
  }

  static parse(possibleLiteral: string): GranularLiteral | undefined {
    const s = possibleLiteral.slice(1);
    const fYear = "yyyy";
    const fMonth = `${fYear}-LL`;
    const fDay = `${fMonth}-dd`;
    const fMinute = `${fDay} HH:mm`;
    const fSecond = `${fMinute}:ss`;

    const tss = DateTime.fromFormat(s, fSecond);
    if (tss.isValid) {
      const nextSecond = tss.plus({ second: 1 }).toFormat(fSecond);
      const tsLit = new GranularLiteral(s, nextSecond, "second");
      tsLit.timeType = "timestamp";
      return tsLit;
    }

    const tsm = DateTime.fromFormat(s, fMinute);
    if (tsm.isValid) {
      const nextMinute = tsm.plus({ minute: 1 }).toFormat(fMinute);
      const tsLit = new GranularLiteral(s, nextMinute, "minute");
      tsLit.timeType = "timestamp";
      return tsLit;
    }

    const quarter = s.match(/(\d{4})-[qQ](\d)$/);
    if (quarter) {
      const qplus = Number.parseInt(quarter[2]) - 1;
      let qstart = DateTime.fromFormat(quarter[1], "yyyy");
      if (qplus > 0) {
        qstart = qstart.plus({ quarters: qplus });
      }
      const qend = qstart.plus({ quarter: 1 });
      return new GranularLiteral(
        `${qstart.toFormat(fDay)}`,
        `${qend.toFormat(fDay)}`,
        "quarter"
      );
    }

    const yyyymmdd = DateTime.fromFormat(s, fDay);
    if (yyyymmdd.isValid) {
      const next = yyyymmdd.plus({ days: 1 });
      return new GranularLiteral(
        `${yyyymmdd.toFormat(fDay)}`,
        `${next.toFormat(fDay)}`,
        "day"
      );
    }

    const yyyymm = DateTime.fromFormat(s, fMonth);
    if (yyyymm.isValid) {
      const next = yyyymm.plus({ months: 1 });
      return new GranularLiteral(
        `${yyyymm.toFormat(fDay)}`,
        `${next.toFormat(fDay)}`,
        "month"
      );
    }

    const yyyy = DateTime.fromFormat(s, fYear);
    if (yyyy.isValid) {
      const year = yyyy.toFormat(`yyyy-01-01`);
      const nextYear = yyyy.plus({ year: 1 }).toFormat(`yyyy-01-01`);
      return new GranularLiteral(year, nextYear, "year");
    }

    if (s.startsWith("WK")) {
      const yyyymmdd = DateTime.fromFormat(s.slice(2), fDay);
      if (yyyymmdd.isValid) {
        // wonky because luxon uses monday weeks and bigquery uses sunday weeks
        let sunday = yyyymmdd;
        if (yyyymmdd.weekday !== 7) {
          sunday = yyyymmdd.startOf("week").minus({ day: 1 });
        }
        const next = sunday.plus({ days: 7 });

        return new GranularLiteral(
          `${sunday.toFormat(fDay)}`,
          `${next.toFormat(fDay)}`,
          "week"
        );
      }
    }

    return undefined;
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const lhs = left.getExpression(fs);

    if (isTimeType(lhs.dataType)) {
      let rangeType: TimeType = "timestamp";
      if (lhs.dataType === "date" && !this.timeType) {
        rangeType = "date";
      }
      const range = new Range(
        new ExprTime(
          rangeType,
          fs.getDialect().sqlLiteralTime(this.moment, rangeType, "UTC")
        ),
        new ExprTime(
          rangeType,
          fs.getDialect().sqlLiteralTime(this.until, rangeType, "UTC")
        )
      );
      return range.apply(fs, op, left);
    }
    return super.apply(fs, op, left);
  }

  thisValueToTimestamp(_selfValue: ExprValue): ExpressionDef {
    return this;
  }

  getExpression(fs: FieldSpace): ExprValue {
    const dataType = this.timeType || "date";
    return {
      dataType: dataType,
      aggregate: false,
      timeframe: this.units,
      value: [fs.getDialect().sqlLiteralTime(this.moment, dataType, "UTC")],
    };
  }
}

export class ExprNow extends ExprTime {
  elementType = "now";
  constructor() {
    super("timestamp", ["CURRENT_TIMESTAMP()"], false);
  }
}

export class ExprDuration extends ExpressionDef {
  elementType = "duration";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(readonly n: ExpressionDef, readonly timeframe: TimeTimeframe) {
    super({ n });
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const lhs = left.getExpression(fs);
    this.typeCheck(this, lhs);
    if (isTimeType(lhs.dataType) && (op === "+" || op === "-")) {
      const num = this.n.getExpression(fs);
      if (!FT.typeEq(num, FT.numberT)) {
        this.log(`Duration units needs number not '${num.dataType}`);
        return errorFor("illegal unit expression");
      }
      let resultGranularity = this.timeframe;
      if (isGranularResult(lhs)) {
        if (granularity(lhs.timeframe) < granularity(resultGranularity)) {
          resultGranularity = lhs.timeframe;
        }
      }
      if (lhs.dataType === "timestamp") {
        const result = timestampOffset(
          fs.getDialect(),
          lhs.value,
          op,
          num.value,
          this.timeframe
        );
        const timePlus: GranularResult = {
          dataType: "timestamp",
          aggregate: lhs.aggregate || num.aggregate,
          timeframe: resultGranularity,
          value: result,
        };
        return timePlus;
      }
      return {
        dataType: "date",
        aggregate: lhs.aggregate || num.aggregate,
        timeframe: resultGranularity,
        value: dateOffset(
          fs.getDialect(),
          lhs.value,
          op,
          num.value,
          this.timeframe
        ),
      };
    }
    return super.apply(fs, op, left);
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return {
      dataType: "duration",
      aggregate: false,
      value: ["__ERROR_DURATION_IS_NOT_A_VALUE__"],
    };
  }
}

export class ExprCompare extends BinaryBoolean<Comparison> {
  elementType = "a<=>b";
  constructor(left: ExpressionDef, op: Comparison, right: ExpressionDef) {
    super(left, op, right);
    this.legalChildTypes = compareTypes[op];
  }

  getExpression(fs: FieldSpace): ExprValue {
    if (!this.right.granular()) {
      const rhs = this.right.requestExpression(fs);
      if (rhs && isGranularResult(rhs)) {
        const newRight = new ExprGranularTime(this.right, rhs.timeframe, false);
        return newRight.apply(fs, this.op, this.left);
      }
    }

    return this.right.apply(fs, this.op, this.left);
  }
}

export class Apply extends ExprCompare {
  elementType = "apply";
  constructor(readonly left: ExpressionDef, readonly right: ExpressionDef) {
    super(left, "=", right);
  }
}

const compareTypes = {
  "~": [FT.stringT],
  "!~": [FT.stringT],
  "<": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  "<=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  "=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  "!=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  ">=": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
  ">": [FT.numberT, FT.stringT, FT.dateT, FT.timestampT],
};

export class PartialCompare extends ExpressionDef {
  elementType = "<=> a";
  constructor(readonly op: Comparison, readonly right: ExpressionDef) {
    super({ right });
  }

  granular(): boolean {
    return this.right.granular();
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    return this.right.apply(fs, this.op, expr);
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    this.log(`Partial comparison does not have a value`);
    return errorFor("no value for partial compare");
  }
}

/**
 * TODO: This is sort of a hand clone of the "Range" class, they should
 * be siblings of a common abstract classs.
 */
export class ForRange extends ExpressionDef {
  elementType = "forRange";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(
    readonly from: ExpressionDef,
    readonly duration: ExpressionDef,
    readonly timeframe: Timeframe
  ) {
    super({ from, duration, timeframe });
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    const startV = this.from.getExpression(fs);
    const checkV = expr.getExpression(fs);
    if (!this.typeCheck(expr, checkV)) {
      return errorFor("no time for range");
    }
    const nV = this.duration.getExpression(fs);
    if (nV.dataType !== "number") {
      this.log(`FOR duration count must be a number, not '${nV.dataType}'`);
      return errorFor("FOR not number");
    }
    const units = this.timeframe.text;

    // ok this is complicated so it is commented to remind myself ...
    // First, if the duration resolution is smaller than date, we have
    // to do the computaion with timestamps.
    const durationRes = resolution(units);
    let rangeType = durationRes;

    // Next, if the beginning of the range is a timestamp, then we
    // also have to do the computation as a timestamp
    if (startV.dataType === "timestamp") {
      rangeType = "timestamp";
    }

    // everything is dates, do date math
    if (checkV.dataType === "date" && rangeType === "date") {
      const rangeStart = this.from;
      const rangeEndV = dateOffset(
        fs.getDialect(),
        checkV.value,
        "+",
        nV.value,
        units
      );
      const rangeEnd = new ExprTime("date", rangeEndV);
      return new Range(rangeStart, rangeEnd).apply(fs, op, expr);
    }

    // Now it doesn't matter if the range is a date or a timestamp,
    // the comparison will be in timestamp space,
    let applyTo = expr;
    if (checkV.dataType === "date") {
      applyTo = new ExprTime(
        "timestamp",
        toTimestampV(fs.getDialect(), checkV).value,
        checkV.aggregate
      );
    }

    let rangeStart = this.from;
    let from = startV.value;
    if (startV.dataType === "date") {
      // This gives granular nodes a chance to control how they become timestamps
      rangeStart = rangeStart.thisValueToTimestamp(startV, fs.getDialect());
      from = rangeStart.getExpression(fs).value;
    }
    const to = timestampOffset(fs.getDialect(), from, "+", nV.value, units);
    const rangeEnd = new ExprTime("timestamp", to, startV.aggregate);

    return new Range(rangeStart, rangeEnd).apply(fs, op, applyTo);
  }

  requestExpression(_fs: FieldSpace): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    this.log("A Range is not a value");
    return errorFor("range has no value");
  }
}

export class ExprTimeExtract extends ExpressionDef {
  elementType = "timeExtract";
  static extractorMap: Record<string, string> = {
    DAY_OF_WEEK: "DAYOFWEEK",
    DAY_OF_YEAR: "DAYOFYEAR",
    DAY: "DAY",
    DAYS: "DAY",
    WEEK: "WEEK",
    WEEKS: "WEEK",
    MONTH: "MONTH",
    MONTHS: "MONTH",
    QUARTER: "QUARTER",
    QUARTERS: "QUARTER",
    YEAR: "YEAR",
    YEARS: "YEAR",
    HOUR: "HOUR",
    HOURS: "HOUR",
    MINUTE: "MINUTE",
    MINUTES: "MINUTE",
    SECOND: "SECOND",
    SECONDS: "SECOND",
  };
  static isExtractor(funcName: string): boolean {
    return ExprTimeExtract.extractorMap[funcName.toUpperCase()] != undefined;
  }

  constructor(readonly name: string, readonly args: ExpressionDef[]) {
    super({ args });
  }

  getExpression(fs: FieldSpace): ExprValue {
    const extractTo = ExprTimeExtract.extractorMap[this.name.toUpperCase()];
    if (extractTo) {
      if (this.args.length !== 1) {
        this.log(`Extraction function ${this.name} requires one argument`);
        return errorFor(`{this.name} arg count`);
      }
      const from = this.args[0];
      if (from instanceof Range) {
        const first = from.first.getExpression(fs);
        const last = from.last.getExpression(fs);
        if (!isTimeType(first.dataType)) {
          from.first.log(`Can't extract ${this.name} from '${first.dataType}'`);
          return errorFor(`${this.name} bad type ${first.dataType}`);
        }
        if (!isTimeType(last.dataType)) {
          from.last.log(`Cannot extract ${this.name} from '${last.dataType}'`);
          return errorFor(`${this.name} bad type ${last.dataType}`);
        }
        return {
          dataType: "number",
          aggregate: first.aggregate || last.aggregate,
          value: [
            {
              type: "timeDiff",
              units: extractTo,
              left: { type: first.dataType, value: first.value },
              right: { type: last.dataType, value: last.value },
            },
          ],
        };
      } else {
        const argV = from.getExpression(fs);
        if (isTimeType(argV.dataType)) {
          return {
            dataType: "number",
            aggregate: argV.aggregate,
            value: compressExpr([
              `EXTRACT(${extractTo} FROM `,
              ...argV.value,
              ")",
            ]),
          };
        }
        this.log(`${this.name}(date or timestamp) not '${argV.dataType}'`);
        return errorFor(`${this.name} bad type ${argV.dataType}`);
      }
    }
    throw this.internalError(`Illegal extraction unit '${this.name}'`);
  }
}

export class ExprFunc extends ExpressionDef {
  elementType = "function call()";
  constructor(readonly name: string, readonly args: ExpressionDef[]) {
    super({ args });
  }

  getExpression(fs: FieldSpace): ExprValue {
    let anyAggregate = false;
    let collectType: FieldValueType | undefined;
    const funcCall: Fragment[] = [`${this.name}(`];
    for (const fexpr of this.args) {
      const expr = fexpr.getExpression(fs);
      if (expr.aggregate) {
        anyAggregate = true;
      }
      if (collectType) {
        funcCall.push(",");
      } else {
        collectType = expr.dataType;
      }
      funcCall.push(...expr.value);
    }
    funcCall.push(")");

    const funcInfo = fs.getDialect().getFunctionInfo(this.name);
    const dataType = funcInfo?.returnType ?? collectType ?? "number";
    return {
      dataType,
      aggregate: anyAggregate,
      value: compressExpr(funcCall),
    };
  }
}
