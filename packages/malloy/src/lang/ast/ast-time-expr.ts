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
  Fragment,
  isTimestampUnit,
  TimestampUnit,
  ExtractUnit,
  isExtractUnit,
  isDateUnit,
  isTimeFieldType,
  TimeFieldType,
  mkExpr,
} from "../../model/malloy_types";
import { FSPair } from "../field-space";
import {
  ExpressionDef,
  BinaryBoolean,
  Range,
  ExprTime,
  ExprValue,
  errorFor,
  isGranularResult,
  TimeResult,
  GranularResult,
  FT,
  timeResult,
  compressExpr,
  FieldValueType,
  MalloyElement,
  Comparison,
  timeOffset,
  resolution,
  castDateToTimestamp,
} from "./index";

export class Timeframe extends MalloyElement {
  elementType = "timeframe";
  readonly text: TimestampUnit;
  constructor(timeframeName: string) {
    super();
    let tf = timeframeName.toLowerCase();
    if (tf.endsWith("s")) {
      tf = tf.slice(0, -1);
    }
    this.text = isTimestampUnit(tf) ? tf : "second";
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

  getExpression(fs: FSPair): ExprValue {
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

  apply(fs: FSPair, op: string, left: ExpressionDef): ExprValue {
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
    fs: FSPair,
    op: string,
    expr: ExpressionDef
  ): ExprValue {
    const begin = this.getExpression(fs);
    const beginTime = ExprTime.fromValue("timestamp", begin);
    const endTime = new ExprTime(
      "timestamp",
      timeOffset("timestamp", begin.value, "+", mkExpr`1`, this.units),
      begin.aggregate
    );
    const range = new Range(beginTime, endTime);
    return range.apply(fs, op, expr);
  }

  protected dateRange(fs: FSPair, op: string, expr: ExpressionDef): ExprValue {
    const begin = this.getExpression(fs);
    const beginTime = new ExprTime("date", begin.value, begin.aggregate);
    const endAt = timeOffset("date", begin.value, "+", ["1"], this.units);
    const end = new ExprTime("date", endAt, begin.aggregate);
    const range = new Range(beginTime, end);
    return range.apply(fs, op, expr);
  }
}

/**
 * GranularTime made from a literal. Funky because it doesn't know if it
 * is a date or a timestamp in many cases until it is applied.
 */
export class GranularLiteral extends ExpressionDef {
  elementType = "timeLiteral";
  timeType?: TimeFieldType;

  constructor(
    readonly moment: string,
    readonly until: string,
    readonly units: TimestampUnit
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
      // working around a weird bigquery bug ...
      const thisMin = s + ":00";
      const nextMinute = tsm.plus({ minute: 1 }).toFormat(fMinute) + ":00";
      const tsLit = new GranularLiteral(thisMin, nextMinute, "minute");
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

  apply(fs: FSPair, op: string, left: ExpressionDef): ExprValue {
    const lhs = left.getExpression(fs);

    if (isTimeFieldType(lhs.dataType)) {
      let rangeType: TimeFieldType = "timestamp";
      if (lhs.dataType === "date" && !this.timeType) {
        rangeType = "date";
      }
      const dialect = fs.in.getDialect();
      const range = new Range(
        new ExprTime(
          rangeType,
          dialect.sqlLiteralTime(this.moment, rangeType, "UTC")
        ),
        new ExprTime(
          rangeType,
          dialect.sqlLiteralTime(this.until, rangeType, "UTC")
        )
      );
      return range.apply(fs, op, left);
    }
    return super.apply(fs, op, left);
  }

  getExpression(fs: FSPair): ExprValue {
    const dataType = this.timeType || "date";
    const value: TimeResult = {
      dataType,
      aggregate: false,
      value: [fs.in.getDialect().sqlLiteralTime(this.moment, dataType, "UTC")],
    };
    // Literals with date resolution can be used as timestamps or dates,
    // this is the third attempt to make that work. It still feels like
    // there should be a better way to make this happen, but the point
    // at which the data is needed, the handle is gone to the ExpressionDef
    // which would allow a method call into this class. I think the second
    // if clause is redundant (see "parse" above, but I'm paranoid)
    if (dataType == "date" && isDateUnit(this.units)) {
      value.alsoTimestamp = true;
    }
    if (this.units != "second") {
      return {
        ...value,
        timeframe: this.units,
      };
    }
    return value;
  }
}

export class ExprNow extends ExpressionDef {
  elementType = "timestamp";

  getExpression(_fs: FSPair): ExprValue {
    return {
      dataType: "timestamp",
      aggregate: false,
      value: [
        {
          type: "dialect",
          function: "now",
        },
      ],
    };
  }
}

export class ExprDuration extends ExpressionDef {
  elementType = "duration";
  legalChildTypes = [FT.timestampT, FT.dateT];
  constructor(readonly n: ExpressionDef, readonly timeframe: TimestampUnit) {
    super({ n });
  }

  apply(fs: FSPair, op: string, left: ExpressionDef): ExprValue {
    const lhs = left.getExpression(fs);
    this.typeCheck(this, lhs);
    if (isTimeFieldType(lhs.dataType) && (op === "+" || op === "-")) {
      const num = this.n.getExpression(fs);
      if (!FT.typeEq(num, FT.numberT)) {
        this.log(`Duration units needs number not '${num.dataType}`);
        return errorFor("illegal unit expression");
      }
      let resultGranularity: TimestampUnit | undefined;
      // Only allow the output of this to be granular if the
      // granularities match, this is still an area where
      // more thought is required.
      if (isGranularResult(lhs) && lhs.timeframe == this.timeframe) {
        resultGranularity = lhs.timeframe;
      }
      if (lhs.dataType === "timestamp") {
        const result = timeOffset(
          "timestamp",
          lhs.value,
          op,
          num.value,
          this.timeframe
        );
        return timeResult(
          {
            dataType: "timestamp",
            aggregate: lhs.aggregate || num.aggregate,
            value: result,
          },
          resultGranularity
        );
      }
      return timeResult(
        {
          dataType: "date",
          aggregate: lhs.aggregate || num.aggregate,
          value: timeOffset("date", lhs.value, op, num.value, this.timeframe),
        },
        resultGranularity
      );
    }
    return super.apply(fs, op, left);
  }

  getExpression(_fs: FSPair): ExprValue {
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

  getExpression(fs: FSPair): ExprValue {
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

  apply(fs: FSPair, op: string, expr: ExpressionDef): ExprValue {
    return this.right.apply(fs, this.op, expr);
  }

  requestExpression(_fs: FSPair): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FSPair): ExprValue {
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

  apply(fs: FSPair, op: string, expr: ExpressionDef): ExprValue {
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

    // If the duration resolution is smaller than date, we have
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
      const rangeEndV = timeOffset("date", startV.value, "+", nV.value, units);
      const rangeEnd = new ExprTime("date", rangeEndV);
      return new Range(rangeStart, rangeEnd).apply(fs, op, expr);
    }

    // Now it doesn't matter if the range is a date or a timestamp,
    // the comparison will be in timestamp space,
    const applyTo = ExprTime.fromValue("timestamp", checkV);

    let rangeStart = this.from;
    let from = startV.value;
    if (startV.dataType === "date") {
      // Time literals with timestamp units can also be used as timestamps;
      const alreadyTs = isGranularResult(startV) && startV.alsoTimestamp;
      if (!alreadyTs) {
        // ... not a literal, need a cast
        from = castDateToTimestamp(from);
      }
      rangeStart = new ExprTime("timestamp", from, startV.aggregate);
    }
    const to = timeOffset("timestamp", from, "+", nV.value, units);
    const rangeEnd = new ExprTime("timestamp", to, startV.aggregate);

    return new Range(rangeStart, rangeEnd).apply(fs, op, applyTo);
  }

  requestExpression(_fs: FSPair): ExprValue | undefined {
    return undefined;
  }

  getExpression(_fs: FSPair): ExprValue {
    this.log("A Range is not a value");
    return errorFor("range has no value");
  }
}

export class ExprTimeExtract extends ExpressionDef {
  elementType = "timeExtract";
  static pluralMap: Record<string, ExtractUnit> = {
    years: "year",
    quarters: "quarter",
    months: "month",
    weeks: "week",
    days: "day",
    hours: "hour",
    minutes: "minute",
    seconds: "second",
  };

  static extractor(funcName: string): ExtractUnit | undefined {
    const mappedName = ExprTimeExtract.pluralMap[funcName];
    if (mappedName) {
      return mappedName;
    }
    if (isExtractUnit(funcName)) {
      return funcName;
    }
  }

  constructor(readonly extractText: string, readonly args: ExpressionDef[]) {
    super({ args });
  }

  getExpression(fs: FSPair): ExprValue {
    const extractTo = ExprTimeExtract.extractor(this.extractText);
    if (extractTo) {
      if (this.args.length !== 1) {
        this.log(`Extraction function ${extractTo} requires one argument`);
        return errorFor(`{this.name} arg count`);
      }
      const from = this.args[0];
      if (from instanceof Range) {
        const first = from.first.getExpression(fs);
        const last = from.last.getExpression(fs);
        if (!isTimeFieldType(first.dataType)) {
          from.first.log(`Can't extract ${extractTo} from '${first.dataType}'`);
          return errorFor(`${extractTo} bad type ${first.dataType}`);
        }
        if (!isTimeFieldType(last.dataType)) {
          from.last.log(`Cannot extract ${extractTo} from '${last.dataType}'`);
          return errorFor(`${extractTo} bad type ${last.dataType}`);
        }
        if (!isTimestampUnit(extractTo)) {
          this.log(`Cannot extract ${extractTo} from a range`);
          return errorFor(`${extractTo} bad extraction`);
        }
        return {
          dataType: "number",
          aggregate: first.aggregate || last.aggregate,
          value: [
            {
              type: "dialect",
              function: "timeDiff",
              units: extractTo,
              left: { valueType: first.dataType, value: first.value },
              right: { valueType: last.dataType, value: last.value },
            },
          ],
        };
      } else {
        const argV = from.getExpression(fs);
        if (isTimeFieldType(argV.dataType)) {
          return {
            dataType: "number",
            aggregate: argV.aggregate,
            value: [
              {
                type: "dialect",
                function: "extract",
                expr: { value: argV.value, valueType: argV.dataType },
                units: extractTo,
              },
            ],
          };
        }
        this.log(
          `${this.extractText}() requires time type, not '${argV.dataType}'`
        );
        return errorFor(`${this.extractText} bad type ${argV.dataType}`);
      }
    }
    throw this.internalError(`Illegal extraction unit '${this.extractText}'`);
  }
}

export class ExprFunc extends ExpressionDef {
  elementType = "function call()";
  constructor(readonly name: string, readonly args: ExpressionDef[]) {
    super({ args });
  }

  getExpression(fs: FSPair): ExprValue {
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

    const funcInfo = fs.in.getDialect().getFunctionInfo(this.name);
    const dataType = funcInfo?.returnType ?? collectType ?? "number";
    return {
      dataType: dataType,
      aggregate: anyAggregate,
      value: compressExpr(funcCall),
    };
  }
}
