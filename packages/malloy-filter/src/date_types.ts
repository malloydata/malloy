/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {FilterLog} from './clause_types';

export type DateTimeUnit =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'instant';

export type DateWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// 7 weeks, 32 hours
export interface Duration {
  amount: number;
  unit: DateTimeUnit;
}

export type DateMomentName = 'now' | 'today' | 'yesterday' | 'tomorrow';

// now, today, yesterday, tomorrow
export interface NamedMoment {
  type: 'named';
  name: DateMomentName;
}

export type DateMomentIntervalOperator = 'last' | 'this' | 'next';

// LAST|UNITOFTIME, LAST|DAYOFWEEK
// THIS|UNITOFTIME
// NEXT|UNITOFTIME, NEXT|DAYOFWEEK
// last month, next tuesday, this month
export interface IntervalMoment {
  type: 'interval';
  kind: DateMomentIntervalOperator;
  unit: DateTimeUnit | DateWeekday;
}

export type DateMomentOffsetFromNowDirection = 'ago' | 'from_now';

// NUMBER|UNITOFTIME|AGO
// NUMBER|UNITOFTIME|FROM|NOW
// 3 hours ago, 6 weeks from now
export interface OffsetMoment {
  type: 'offset_from_now';
  direction: DateMomentOffsetFromNowDirection;
  unit: DateTimeUnit;
  amount: number;
}

export type DateMomentSpanFromNowDirection = 'last' | 'next';

// LAST|NUMBER|UNITOFTIME
// NEXT|NUMBER|UNITOFTIME
// last 3 hours, next 2025 seconds, last 6 weeks
export interface SpanMoment {
  type: 'span_from_now';
  direction: DateMomentSpanFromNowDirection;
  unit: DateTimeUnit;
  amount: number;
}

// 2005, 2005-01, 2005-01-01, 2005-01-01 00:00, 2005-01-01 00:00:01
export interface AbsoluteMoment {
  type: 'absolute';
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
  operator: 'after';
  moment: DateMoment;
}

// before 2005-01, before 3 hours ago
export interface DateBeforeClause {
  operator: 'before';
  moment: DateMoment;
}

// next week, last 3 weeks, 3 days ago
export interface DateOnClause {
  operator: 'on';
  moment: DateMoment;
}

// 2015 to next month
export interface DateBetweenClause {
  operator: 'to_range';
  from: DateMoment;
  to: DateMoment;
}

// 2025-01-01 12:00:00 for 3 days
export interface DateForClause {
  operator: 'for_range';
  from: DateMoment;
  duration: Duration;
}

export interface DateNullClause {
  operator: 'null';
}

export interface DateNotNullClause {
  operator: 'not_null';
}

// 3 days
export interface DateDurationClause {
  operator: 'duration';
  duration: Duration;
}

export type DateClause =
  | DateAfterClause
  | DateBeforeClause
  | DateOnClause
  | DateBetweenClause
  | DateForClause
  | DateNullClause
  | DateNotNullClause
  | DateDurationClause;

export interface DateParserResponse {
  clauses: DateClause[];
  logs: FilterLog[];
}
