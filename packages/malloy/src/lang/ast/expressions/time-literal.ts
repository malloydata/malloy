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
import {ExpressionDef} from '../types/expression-def';
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

  protected getLiteral(): TimeLiteralFragment {
    return {
      type: 'dialect',
      function: 'timeLiteral',
      literal: this.literalPart,
      literalType: this.timeType,
      timezone: this.timeZone,
    };
  }

  protected getValue(): TimeResult {
    const timeFrag = this.getLiteral();
    const dataType = timeFrag.literalType;
    const expressionType = 'scalar';
    const value = [timeFrag];
    if (this.units) {
      return {dataType, expressionType, value, timeframe: this.units};
    }
    return {dataType, expressionType, value};
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.getValue();
  }

  apply(fs: FieldSpace, op: string, left: ExpressionDef): ExprValue {
    if (this.nextLit) {
      // We have a chance to write our own range comparison will all constants.
      const lhs = left.getExpression(fs);

      // MTOY todo ... only apply range on ? maybe
      if (isTimeFieldType(lhs.dataType)) {
        let rangeType: TimeFieldType = 'timestamp';
        if (lhs.dataType === 'date' && !this.timeType) {
          rangeType = 'date';
        }
        const rangeStart = this.getLiteral();
        const rangeEnd = {...rangeStart, literal: this.nextLit};
        const range = new Range(
          new ExprTime(rangeType, [rangeStart]),
          new ExprTime(rangeType, [rangeEnd])
        );
        return range.apply(fs, op, left);
      }
    }
    return super.apply(fs, op, left);
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
    let validParse = false;
    let units: TimestampUnit | undefined = undefined;
    let next: string | undefined = undefined;
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
      // TODO mtoy subsecond units not ignored
    }
    const tss = LuxonDateTime.fromFormat(literalTs, fTimestamp);
    if (tss.isValid) {
      validParse = true;
    } else {
      const tsm = LuxonDateTime.fromFormat(literalTs, fMinute);
      if (tsm.isValid) {
        validParse = true;
        tm.text = tm.text + ':00';
        units = 'minute';
        next = tss.plus({minute: 1}).toFormat(fTimestamp);
        // MTOY todo minutes should be granular
      }
    }
    if (validParse) {
      const ts = new LiteralTimestamp(tm, units);
      if (next) {
        ts.nextLit = next;
      }
      return ts;
    }
    return undefined;
  }
}

/**
 * Granular literals imply a range. The end of that range is a constant
 * in the generated expression, computed at compile time, to make filters faster.
 */
abstract class GranularLiteral extends TimeLiteral {
  constructor(
    tm: TimeText,
    units: TimestampUnit | undefined,
    timeType: TimeFieldType,
    readonly nextLit: string
  ) {
    super(tm, units, timeType);
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

abstract class DateBasedLiteral extends GranularLiteral {
  constructor(tm: TimeText, units: TimestampUnit, nextLit: string) {
    super(tm, units, 'date', nextLit);
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const morphicValue = this.getValue();
    const tsLiteral = this.getLiteral();
    tsLiteral.literalType = 'timestamp';
    tsLiteral.literal = tsLiteral.literal + ' 00:00:00';
    morphicValue.morphic = {timestamp: [tsLiteral]};
    return morphicValue;
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
      nextDay = dayParse.plus({day: 1}).toFormat(fTimestamp);
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
      // wonky because luxon uses monday weeks and bigquery uses sunday weeks
      let sunday = yyyymmdd;
      if (yyyymmdd.weekday !== 7) {
        sunday = yyyymmdd.startOf('week').minus({day: 1});
      }
      const next = sunday.plus({days: 7});

      tm.text = sunday.toFormat(fDay);
      nextWeek = next.toFormat(fDay);
      return new LiteralWeek(tm, nextWeek);
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
