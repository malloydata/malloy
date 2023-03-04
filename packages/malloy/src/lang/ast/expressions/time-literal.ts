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
import {TimeResult} from '../types/time-result';
import {ExpressionDef} from '../types/expression-def';

interface TimeText {
  text: string;
  tzSpec?: string;
  isLocale?: boolean;
}

/**
 * Finds and seperates out an optional timezone description from a time literal
 * @param literal legal Malloy timestamp literal string
 */
function preParse(literal: string): TimeText {
  const text = literal.slice(1); // Drop the '@'

  const hasLocale = text.match(/\[[^\]]+]$/);
  if (hasLocale) {
    const tzSpec = hasLocale[0].slice(1, -1);
    return {tzSpec, text: text.slice(0, -hasLocale[0].length), isLocale: true};
  }

  const hasOffsetTz = text.match(/[+-]\d+(:\d+)$/);
  if (hasOffsetTz) {
    const tzSpec = hasOffsetTz[0];
    return {tzSpec, text: text.slice(0, -tzSpec.length)};
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
  isLocale?: boolean;
  constructor(
    tm: TimeText,
    readonly units: TimestampUnit | undefined,
    readonly timeType: TimeFieldType
  ) {
    super();
    this.literalPart = tm.text;
    if (tm.tzSpec) {
      this.timeZone = tm.tzSpec;
      if (tm.isLocale) {
        this.isLocale = true;
      }
    }
  }

  protected getLiteral(): TimeLiteralFragment {
    if (this.timeZone) {
      return {
        type: 'dialect',
        function: 'timeLiteral',
        literal: this.literalPart,
        literalType: this.timeType,
        timezone: this.timeZone,
        tzIsLocale: this.isLocale,
      };
    } else {
      return {
        type: 'dialect',
        function: 'timeLiteral',
        literal: this.literalPart,
        literalType: this.timeType,
        timezone: 'UTC', // MTOY todo when civil literals are a thing
      };
    }
  }

  private getValue(): ExprValue {
    const timeFrag = this.getLiteral();
    const value: TimeResult = {
      dataType: timeFrag.literalType,
      expressionType: 'scalar',
      value: [timeFrag],
    };
    // Literals with date resolution can be used as timestamps or dates,
    // this is the third attempt to make that work. It still feels like
    // there should be a better way to make this happen, but the point
    // at which the data is needed, the handle is gone to the ExpressionDef
    // which would allow a method call into this class.
    //
    // MTOY todo when civil/concrete value matching happens, use it here too
    if (timeFrag.literalType === 'date') {
      value.alsoTimestamp = true;
    }
    if (this.units) {
      return {...value, timeframe: this.units};
    }
    return value;
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

  constructor(literalTs: string) {
    // let subSecs: string | undefined;
    let validParse = false;
    let units: TimestampUnit | undefined = undefined;
    let next: string | undefined = undefined;
    const tm = preParse(literalTs);
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
    super(tm, units, 'timestamp');
    // Can't call "this.internalError" until after the call to super
    if (!validParse) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
    if (next) {
      this.nextLit = next;
    }
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
export class LiteralMinute extends GranularLiteral {
  elementType = 'literal:minute';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let nextMinute = tm.text;
    const minuteParse = LuxonDateTime.fromFormat(tm.text, fMinute);
    let parsed = false;
    if (minuteParse.isValid) {
      tm.text = tm.text + ':00';
      nextMinute = minuteParse.plus({minute: 1}).toFormat(fTimestamp);
      parsed = true;
    }
    super(tm, 'minute', 'timestamp', nextMinute);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}

export class LiteralHour extends GranularLiteral {
  elementType = 'literal:hour';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let nextHour = tm.text;
    const hourParse = LuxonDateTime.fromFormat(tm.text, fHour);
    let parsed = false;
    if (hourParse.isValid) {
      tm.text = tm.text + ':00:00';
      nextHour = hourParse.plus({hour: 1}).toFormat(fTimestamp);
      parsed = true;
    }
    super(tm, 'hour', 'timestamp', nextHour);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}

abstract class DateBasedLiteral extends GranularLiteral {
  constructor(tm: TimeText, units: TimestampUnit, nextLit: string) {
    super(tm, units, 'date', nextLit);
  }
}

export class LiteralDay extends DateBasedLiteral {
  elementType = 'literal:day';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let nextDay = tm.text;
    const dayParse = LuxonDateTime.fromFormat(tm.text, fDay);
    let parsed = false;
    if (dayParse.isValid) {
      nextDay = dayParse.plus({day: 1}).toFormat(fTimestamp);
      parsed = true;
    }
    super(tm, 'day', nextDay);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}

export class LiteralWeek extends DateBasedLiteral {
  elementType = 'literal:week';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let nextWeek = tm.text;
    let parsed = false;
    const yyyymmdd = LuxonDateTime.fromFormat(tm.text.slice(2), fDay);
    if (yyyymmdd.isValid) {
      // wonky because luxon uses monday weeks and bigquery uses sunday weeks
      let sunday = yyyymmdd;
      if (yyyymmdd.weekday !== 7) {
        sunday = yyyymmdd.startOf('week').minus({day: 1});
      }
      const next = sunday.plus({days: 7});

      tm.text = sunday.toFormat(fDay);
      nextWeek = next.toFormat(fDay);
      parsed = true;
    }
    super(tm, 'week', nextWeek);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}

export class LiteralMonth extends DateBasedLiteral {
  elementType = 'literal:month';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let nextMonth = tm.text;
    let parsed = false;
    const yyyymm = LuxonDateTime.fromFormat(tm.text, fMonth);
    if (yyyymm.isValid) {
      const next = yyyymm.plus({months: 1});
      tm.text = yyyymm.toFormat(fDay);
      nextMonth = next.toFormat(fDay);
      parsed = true;
    }
    super(tm, 'month', nextMonth);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}

export class LiteralQuarter extends DateBasedLiteral {
  elementType = 'quarterLiteral';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let nextQuarter = tm.text;
    let parsed = false;
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
      parsed = true;
    }
    super(tm, 'quarter', nextQuarter);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}

export class LiteralYear extends DateBasedLiteral {
  elementType = 'literal:year';
  constructor(literalTs: string) {
    const tm = preParse(literalTs);
    let next = tm.text;
    let parsed = false;
    const yyyy = LuxonDateTime.fromFormat(tm.text, fYear);
    if (yyyy.isValid) {
      const nextYear = yyyy.plus({year: 1});
      tm.text = yyyy.toFormat(fDay);
      next = nextYear.toFormat(fDay);
      parsed = true;
    }
    super(tm, 'year', next);
    if (!parsed) {
      throw this.internalError('Malloy timestamp parser out of spec');
    }
  }
}
