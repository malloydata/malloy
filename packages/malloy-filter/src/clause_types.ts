export type NumberOperator = '<=' | '>=' | '!=' | '=' | '>' | '<';

export type NumberValue = number | null;

export interface NumberCondition {
    operator: NumberOperator;
    values: NumberValue[];
}

export type NumberRangeOperator = '<=' | '>=' | '>' | '<';

export interface NumberRange {
    operator: 'range';
    startOperator: NumberRangeOperator;
    startValue: NumberValue;
    endOperator: NumberRangeOperator;
    endValue: NumberValue;
}

export type QuoteType = 
  | 'SINGLE' 
  | 'DOUBLE' 
  | 'BACKTICK' 
  | 'TRIPLESINGLE' 
  | 'TRIPLEDOUBLE' 
  | 'ESCAPEDSINGLE' 
  | 'ESCAPEDDOUBLE' 
  | 'ESCAPEDBACKTICK';

export type StringOperator = 'EMPTY' | 'NOTEMPTY' | 'starts' | 'ends' | 'contains' | 'notStarts' |
    'notEnds' | 'notContains' | '~' | '=' | '!~' | '!=';

export type StringValue = string | null;


export interface StringCondition {
    operator: StringOperator;
    values: StringValue[];
    quotes?: QuoteType[];  // List of quote types found in the string.
}

export type BooleanOperator = 'TRUE' | 'FALSE' | 'NULL' | 'NOTNULL';

export interface BooleanClause {
    operator: BooleanOperator;
}

export type DatePrefix = 'BEFORE' | 'AFTER';

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
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type DateMomentNowOperator = 'NOW' | 'TODAY' | 'YESTERDAY' | 'TOMORROW';

// now, after today, before yesterday, tomorrow
export interface DateMomentNow {
    prefix?: DatePrefix;
    operator: DateMomentNowOperator;
}

export type DateMomentIntervalOperator = 'LAST' | 'THIS' | 'NEXT';

// LAST|UNITOFTIME, LAST|DAYOFWEEK
// THIS|UNITOFTIME
// NEXT|UNITOFTIME, NEXT|DAYOFWEEK
// before last month, after next tuesday, this month
export interface DateMomentInterval {
    prefix?: DatePrefix;
    operator: DateMomentIntervalOperator;
    unit: DateTimeUnit | DateWeekday;
}

export type DateMomentNumberIntervalOperator = 'LASTN' | 'NEXTN' | 'AGO' | 'FROMNOW';

// LAST|NUMBER|UNITOFTIME
// NEXT|NUMBER|UNITOFTIME
// NUMBER|UNITOFTIME|AGO
// NUMBER|UNITOFTIME|FROM|NOW 
// before 3 hours ago, next 5 days, 2025 seconds ago, after 6 weeks from now
export interface DateMomentNumberInterval {
    prefix?: DatePrefix;
    operator: DateMomentNumberIntervalOperator;
    unit: DateTimeUnit;
    value: string;
}

export type DateMomentNumberUnitOperator = 'TIMEBLOCK';

// NUMBER|UNITOFTIME
// 2025 seconds, after 32 hours
export interface DateMomentNumberUnit {
    prefix?: DatePrefix;
    operator: DateMomentNumberUnitOperator;
    unit: DateTimeUnit;
    value: string;
}

export type DateMomentNumberOperator = 'DATE' | 'DATETIME';

// DATE|TIME, DATE
// after 2025, before 2025-08-04, 2025-08-04 08:11:52
export interface DateMomentNumber {
    prefix?: DatePrefix;
    operator: DateMomentNumberOperator;
    date: string;
    time?: string;
}

export type DateMoment = DateMomentNow | DateMomentInterval | DateMomentNumberInterval |
DateMomentNumberUnit | DateMomentNumber;

export interface DateRange {
    start: DateMoment;
    operator: 'TO' | 'FOR';
    end: DateMoment;
}

export type NumberClause = NumberCondition | NumberRange;

export type DateClause = DateMoment | DateRange;

export type Clause = NumberClause | StringCondition | BooleanClause | DateClause;
