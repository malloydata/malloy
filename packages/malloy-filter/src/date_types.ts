import {FilterError} from './clause_types';

export type DateTimeUnit =
  | 'YEAR'
  | 'QUARTER'
  | 'MONTH'
  | 'WEEK'
  | 'DAY'
  | 'HOUR'
  | 'MINUTE'
  | 'SECOND';

export type DateWeekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

// 7 weeks, 32 hours
export interface Duration {
  amount: number;
  unit: DateTimeUnit;
}

export type DateMomentName = 'NOW' | 'TODAY' | 'YESTERDAY' | 'TOMORROW';

// now, today, yesterday, tomorrow
export interface NamedMoment {
  type: 'NAMED';
  name: DateMomentName;
}

export type DateMomentIntervalOperator = 'LAST' | 'THIS' | 'NEXT';

// LAST|UNITOFTIME, LAST|DAYOFWEEK
// THIS|UNITOFTIME
// NEXT|UNITOFTIME, NEXT|DAYOFWEEK
// last month, next tuesday, this month
export interface IntervalMoment {
  type: 'INTERVAL';
  kind: DateMomentIntervalOperator;
  unit: DateTimeUnit | DateWeekday;
}

export type DateMomentOffsetFromNowDirection = 'AGO' | 'FROMNOW';

// NUMBER|UNITOFTIME|AGO
// NUMBER|UNITOFTIME|FROM|NOW
// 3 hours ago, 6 weeks from now
export interface OffsetMoment {
  type: 'OFFSET_FROM_NOW';
  direction: DateMomentOffsetFromNowDirection;
  unit: DateTimeUnit;
  amount: number;
}

export type DateMomentSpanFromNowDirection = 'LAST' | 'NEXT';

// LAST|NUMBER|UNITOFTIME
// NEXT|NUMBER|UNITOFTIME
// last 3 hours, next 2025 seconds, last 6 weeks
export interface SpanMoment {
  type: 'SPAN_FROM_NOW';
  direction: DateMomentSpanFromNowDirection;
  unit: DateTimeUnit;
  amount: number;
}

// 2005, 2005-01, 2005-01-01, 2005-01-01 00:00, 2005-01-01 00:00:01
export interface AbsoluteMoment {
  type: 'ABSOLUTE';
  date: string;
  unit: DateTimeUnit;
}

// 2025-01
// {
//   operator: 'ON';
//   moment: { date: '2025-01';
//   unit: 'MONTH' }
// }

// after 2025-01
// {
//   operator: 'AFTER';
//   moment: { date: '2025-01';
//   unit: 'MONTH' }
// }

export type DateMoment =
  | AbsoluteMoment //  2005-01
  | NamedMoment // "today"
  | IntervalMoment // "this month"
  | SpanMoment // "last 3 weeks, next 3 weeks
  | OffsetMoment; // "3 days ago"

// after 2005-01, after 3 hours ago
export interface DateAfterClause {
  operator: 'AFTER';
  moment: DateMoment;
}

// before 2005-01, before 3 hours ago
export interface DateBeforeClause {
  operator: 'BEFORE';
  moment: DateMoment;
}

// next week, last 3 weeks, 3 days ago
export interface DateOnClause {
  operator: 'ON';
  moment: DateMoment;
}

// 2015 to next month
export interface DateBetweenClause {
  operator: 'TO_RANGE';
  from: DateMoment;
  to: DateMoment;
}

// 2025-01-01 12:00:00 for 3 days
export interface DateForClause {
  operator: 'FOR_RANGE';
  from: DateMoment;
  duration: Duration;
}

// 3 days
export interface DateDurationClause {
  operator: 'DURATION';
  duration: Duration;
}

export type DateClause =
  | DateAfterClause
  | DateBeforeClause
  | DateOnClause
  | DateBetweenClause
  | DateForClause
  | DateDurationClause;

export interface DateParserResponse {
  clauses: DateClause[];
  errors: FilterError[];
}
