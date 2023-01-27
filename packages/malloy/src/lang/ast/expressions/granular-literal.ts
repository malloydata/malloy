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
  isDateUnit,
  isTimeFieldType,
  TimeFieldType,
  TimestampUnit,
} from "../../../model/malloy_types";

import { ExprValue } from "../compound-types/expr-value";
import { FieldSpace } from "../field-space";
import { ExprTime, Range } from "../time-expressions";
import { timeLiteral } from "../time-utils";
import { TimeResult } from "../type-interfaces/time-result";
import { ExpressionDef } from "./expression-def";

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
