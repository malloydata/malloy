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

import {DateTime as LuxonDateTime} from 'luxon';

import {
  TimeFieldType,
  TimestampUnit,
  isTimeFieldType,
  TimeLiteralFragment,
} from '../../../model/malloy_types';

import {ExprValue} from '../types/expr-value';
import {FieldSpace} from '../types/field-space';
import {Range} from './range';
import {ExprTime} from './expr-time';
import {ExpressionDef, getMorphicValue} from '../types/expression-def';
import {TimeResult} from '../types/time-result';

export class TimeFormatError extends Error {}

interface TimeText {
  text: string;
  tzSpec?: string;
}

/**
 * Finds and seperates out an optional timezone description from a time literal
 * @param literal legal Malloy timestamp literal string
 */
function preParse(literal: string, checkTz: boolean): TimeText {
  const text = literal.slice(1); // Drop the '@'

  if (checkTz) {
    const hasLocale = text.match(/\[[^\]]+]$/);
    if (hasLocale) {
      const tzSpec = hasLocale[0].slice(1, -1);
      return {
        tzSpec,
        text: text.slice(0, -hasLocale[0].length),
      };
    }
  }
  return {text};
}

const fYear = 'yyyy';
const fMonth = `${fYear}-LL`;
const fDay = `${fMonth}-dd`;
const fHour = `${fDay} HH`;
const fMinute = `${fHour}:mm`;
const fTimestamp = `${fMinute}:ss`;

/**
 * Literals specified with an @ in Malloy all become one of these
 */
abstract class TimeLiteral extends ExpressionDef {
  literalPart: string;
  nextLit?: string;
  timeZone?: string;
  constructor(
    tm: TimeText,
    readonly units: TimestampUnit | undefined,
    readonly timeType: TimeFieldType
  ) {
    super();
    this.literalPart = tm.text;
    if (tm.tzSpec) {
      this.timeZone = tm.tzSpec;
    }
  }

  protected makeLiteral(val: string, typ: TimeFieldType): TimeLiteralFragment {
    const timeFrag: TimeLiteralFragment = {
      type: 'dialect',
      function: 'timeLiteral',
      literal: val,
      literalType: typ,
    };
    if (this.timeZone) {
      timeFrag.timezone = this.timeZone;
    }
    return timeFrag;
  }

  protected makeValue(val: string, dataType: TimeFieldType): TimeResult {
    const timeFrag = this.makeLiteral(val, dataType);
    const expressionType = 'scalar';
    const value = [timeFrag];
    if (this.units) {
      return {dataType, expressionType, value, timeframe: this.units};
    }
    return {dataType, expressionType, value};
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.makeValue(this.literalPart, this.timeType);
  }

  getNext(): ExprValue | undefined {
    if (this.nextLit) {
      return this.makeValue(this.nextLit, this.timeType);
    }
  }

  granular(): boolean {
    return this.nextLit !== undefined;
  }
}

export class LiteralTimestamp extends TimeLiteral {
  elementType = 'literal:timestamp';

  constructor(tm: TimeText, units?: TimestampUnit) {
    super(tm, units, 'timestamp');
  }

  static parse(literalTs: string): LiteralTimestamp | undefined {
    // let subSecs: string | undefined;
    let units: TimestampUnit | undefined = undefined;
    const tm = preParse(literalTs, true);
    literalTs = tm.text;
    if (literalTs[10] === 'T') {
      literalTs = literalTs.slice(0, 10) + ' ' + literalTs.slice(11);
      tm.text = literalTs;
    }

    const hasSubsecs = literalTs.match(/^([^.,]+)[,.](\d+)$/);
    if (hasSubsecs) {
      literalTs = hasSubsecs[1];
      // subSecs = hasSubsecs[2];
      // mtoy TODO subsecond units not ignored
    }
    let ts = LuxonDateTime.fromFormat(literalTs, fTimestamp);
    if (ts.isValid) {
      return new LiteralTimestamp(tm, units);
    } else {
      ts = LuxonDateTime.fromFormat(literalTs, fMinute);
      if (ts.isValid) {
        tm.text = tm.text + ':00';
        units = 'minute';
        const next = ts.plus({minute: 1}).toFormat(fTimestamp);
        const astMinute = new GranularLiteral(tm, units, 'timestamp', next);
        return astMinute;
      }
    }
    return undefined;
  }
}

/**
 * Granular literals imply a range. The end of that range is a constant
 * in the generated expression, computed at compile time, to make filters faster.
 */
class GranularLiteral extends TimeLiteral {
  elementType = 'granularTimeLiteral';
  constructor(
    tm: TimeText,
    units: TimestampUnit | undefined,
    timeType: TimeFieldType,
    readonly nextLit: string
  ) {
    super(tm, units, timeType);
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    // We have a chance to write our own range comparison will all constants.
    let rangeStart = this.getExpression(fs);
    let rangeEnd = this.getNext();

    if (rangeEnd) {
      const testValue = left.getExpression(fs);

      if (testValue.dataType === 'timestamp') {
        const newStart = getMorphicValue(rangeStart, 'timestamp');
        const newEnd = getMorphicValue(rangeEnd, 'timestamp');
        if (newStart && newEnd) {
          rangeStart = newStart;
          rangeEnd = newEnd;
        } else {
          return super.apply(fs, op, left);
        }
      }

      if (isTimeFieldType(testValue.dataType)) {
        const rangeType = testValue.dataType;
        const range = new Range(
          new ExprTime(rangeType, rangeStart.value),
          new ExprTime(rangeType, rangeEnd.value)
        );
        return range.apply(fs, op, left);
      }
    }
    return super.apply(fs, op, left);
  }
}

// MTOY todo should probably put the time zone information into the luxon object
// so that "adding an hour just before DST" works properly when a locale based
// time is specified, but then that introduces the possibility that a locale
// is defined differently in the DB than in Luxon ... which i don't have
// the brain space to think about right now

export class LiteralHour extends GranularLiteral {
  elementType = 'literal:hour';
  constructor(tm: TimeText, next: string) {
    super(tm, 'hour', 'timestamp', next);
  }

  static parse(literalTs: string): LiteralHour | undefined {
    const tm = preParse(literalTs, false);
    let nextHour = tm.text;
    const hourParse = LuxonDateTime.fromFormat(tm.text, fHour);
    if (hourParse.isValid) {
      tm.text = tm.text + ':00:00';
      nextHour = hourParse.plus({hour: 1}).toFormat(fTimestamp);
      return new LiteralHour(tm, nextHour);
    }
  }
}

/**
 * DateBasedLiteral and all of the children are special because a literal
 * of this type (e.g. @2003) can be used in expressions with Date or
 * Timestamp data, and the correct literal will be used based on context.
 */
abstract class DateBasedLiteral extends GranularLiteral {
  constructor(tm: TimeText, units: TimestampUnit, nextLit: string) {
    super(tm, units, 'date', nextLit);
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const dateValue = this.makeValue(this.literalPart, 'date');
    const timestamp = [
      this.makeLiteral(`${this.literalPart} 00:00:00`, 'timestamp'),
    ];
    return {...dateValue, morphic: {timestamp}};
  }

  getNext(): ExprValue | undefined {
    const dateValue = this.makeValue(this.nextLit, 'date');
    const timestamp = [
      this.makeLiteral(`${this.nextLit} 00:00:00`, 'timestamp'),
    ];
    return {...dateValue, morphic: {timestamp}};
  }
}

export class LiteralDay extends DateBasedLiteral {
  elementType = 'literal:day';

  constructor(tm: TimeText, next: string) {
    super(tm, 'day', next);
  }

  static parse(literalTs: string): LiteralDay | undefined {
    const tm = preParse(literalTs, false);
    let nextDay = tm.text;
    const dayParse = LuxonDateTime.fromFormat(tm.text, fDay);
    if (dayParse.isValid) {
      nextDay = dayParse.plus({day: 1}).toFormat(fDay);
      return new LiteralDay(tm, nextDay);
    }
  }
}

export class LiteralWeek extends DateBasedLiteral {
  elementType = 'literal:week';

  constructor(tm: TimeText, next: string) {
    super(tm, 'week', next);
  }

  static parse(literalTs: string): LiteralWeek | undefined {
    const tm = preParse(literalTs, false);
    let nextWeek = tm.text;
    const datePart = tm.text.slice(0, 10);
    const yyyymmdd = LuxonDateTime.fromFormat(datePart, fDay);
    if (yyyymmdd.isValid) {
      const luxonDay = yyyymmdd.weekday;
      if (luxonDay === 7) {
        // Weeks must start on a sunday. If you don't know when the
        // week starts use @YYYY-MM-DD.week to truncate
        const next = yyyymmdd.plus({days: 7});

        tm.text = yyyymmdd.toFormat(fDay);
        nextWeek = next.toFormat(fDay);
        return new LiteralWeek(tm, nextWeek);
      }
    }
  }
}

export class LiteralMonth extends DateBasedLiteral {
  elementType = 'literal:month';

  constructor(tm: TimeText, next: string) {
    super(tm, 'month', next);
  }

  static parse(literalTs: string) {
    const tm = preParse(literalTs, false);
    let nextMonth = tm.text;
    const yyyymm = LuxonDateTime.fromFormat(tm.text, fMonth);
    if (yyyymm.isValid) {
      const next = yyyymm.plus({months: 1});
      tm.text = yyyymm.toFormat(fDay);
      nextMonth = next.toFormat(fDay);
      return new LiteralMonth(tm, nextMonth);
    }
  }
}

export class LiteralQuarter extends DateBasedLiteral {
  elementType = 'literal:quarter';

  constructor(tm: TimeText, next: string) {
    super(tm, 'quarter', next);
  }

  static parse(literalTs: string): LiteralQuarter | undefined {
    const tm = preParse(literalTs, false);
    let nextQuarter = tm.text;
    const quarter = tm.text.match(/(^\d{4})-[qQ](\d)$/);
    if (quarter) {
      const qplus = Number.parseInt(quarter[2]) - 1;
      let qstart = LuxonDateTime.fromFormat(quarter[1], 'yyyy');
      if (qplus > 0) {
        qstart = qstart.plus({quarters: qplus});
      }
      const qend = qstart.plus({quarter: 1});
      tm.text = qstart.toFormat(fDay);
      nextQuarter = qend.toFormat(fDay);
      return new LiteralQuarter(tm, nextQuarter);
    }
  }
}

export class LiteralYear extends DateBasedLiteral {
  elementType = 'literal:year';

  constructor(tm: TimeText, next: string) {
    super(tm, 'year', next);
  }

  static parse(literalTs: string) {
    const tm = preParse(literalTs, false);
    let next = tm.text;
    const yyyy = LuxonDateTime.fromFormat(tm.text, fYear);
    if (yyyy.isValid) {
      const nextYear = yyyy.plus({year: 1});
      tm.text = yyyy.toFormat(fDay);
      next = nextYear.toFormat(fDay);
      return new LiteralYear(tm, next);
    }
  }
}
