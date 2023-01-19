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
  maxExpressionType,
  ExpressionType,
} from "../../model/malloy_types";
import {
  Comparison,
  compressExpr,
  errorFor,
  ExprValue,
  FieldValueType,
  FT,
  isGranularResult,
  TimeResult,
} from "./ast-types";
import {
  castDateToTimestamp,
  resolution,
  timeLiteral,
  timeOffset,
} from "./time-utils";
import {
  ExpressionDef,
  ExprTime,
  FieldSpace,
  MalloyElement,
  Range,
} from "./ast-main";

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

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    const lhs = left.getExpression(fs);

    if (isTimeFieldType(lhs.dataType)) {
      let rangeType: TimeFieldType = "timestamp";
      if (lhs.dataType === "date" && !this.timeType) {
        rangeType = "date";
      }
      const range = new Range(
        new ExprTime(rangeType, timeLiteral(this.moment, rangeType, "UTC")),
        new ExprTime(rangeType, timeLiteral(this.until, rangeType, "UTC"))
      );
      return range.apply(fs, op, left);
    }
    return super.apply(fs, op, left);
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const dataType = this.timeType || "date";
    const value: TimeResult = {
      dataType,
      expressionType: "scalar",
      value: timeLiteral(this.moment, dataType, "UTC"),
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

  getExpression(_fs: FieldSpace): ExprValue {
    return {
      dataType: "timestamp",
      expressionType: "scalar",
      value: [
        {
          type: "dialect",
          function: "now",
        },
      ],
    };
  }
}

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
      rangeStart = new ExprTime("timestamp", from, startV.expressionType);
    }
    const to = timeOffset("timestamp", from, "+", nV.value, units);
    const rangeEnd = new ExprTime("timestamp", to, startV.expressionType);

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

  getExpression(fs: FieldSpace): ExprValue {
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
          expressionType: maxExpressionType(
            first.expressionType,
            last.expressionType
          ),
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
            expressionType: argV.expressionType,
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

  getExpression(fs: FieldSpace): ExprValue {
    let expressionType: ExpressionType = "scalar";
    let collectType: FieldValueType | undefined;
    const funcCall: Fragment[] = [`${this.name}(`];
    for (const fexpr of this.args) {
      const expr = fexpr.getExpression(fs);
      expressionType = maxExpressionType(expressionType, expr.expressionType);

      if (collectType) {
        funcCall.push(",");
      } else {
        collectType = expr.dataType;
      }
      funcCall.push(...expr.value);
    }
    funcCall.push(")");

    const dialect = fs.dialectObj();
    const dataType =
      dialect?.getFunctionInfo(this.name)?.returnType ??
      collectType ??
      "number";
    return {
      dataType: dataType,
      expressionType,
      value: compressExpr(funcCall),
    };
  }
}
