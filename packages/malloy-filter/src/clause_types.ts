export type NumberOperator = '<=' | '>=' | '!=' | '=' | '>' | '<';

export type NumberValue = number;

export interface NumberCondition {
  operator: NumberOperator;
  values: NumberValue[];
}

export interface NumberNull {
  operator: 'NULL';
}

export interface NumberNotNull {
  operator: 'NOTNULL';
}

export type NumberRangeOperator = '<=' | '>=' | '>' | '<';

export interface NumberRange {
  operator: 'range';
  startOperator: NumberRangeOperator;
  startValue: NumberValue;
  endOperator: NumberRangeOperator;
  endValue: NumberValue;
}

export type NumberClause =
  | NumberCondition
  | NumberRange
  | NumberNull
  | NumberNotNull;

export type StringConditionOperator =
  | 'starts'
  | 'ends'
  | 'contains'
  | 'notStarts'
  | 'notEnds'
  | 'notContains'
  | '~'
  | '='
  | '!~'
  | '!=';

export type StringValue = string;

export interface StringCondition {
  operator: StringConditionOperator;
  values: StringValue[];
}

export interface StringNull {
  operator: 'NULL';
}

export interface StringNotNull {
  operator: 'NOTNULL';
}

export interface StringEmpty {
  operator: 'EMPTY';
}

export interface StringNotEmpty {
  operator: 'NOTEMPTY';
}

export type StringClause =
  | StringCondition
  | StringNull
  | StringNotNull
  | StringEmpty
  | StringNotEmpty;

export type BooleanOperator =
  | 'TRUE'
  | 'FALSE'
  | 'FALSEORNULL'
  | 'NULL'
  | 'NOTNULL';

export interface BooleanClause {
  operator: BooleanOperator;
}

export interface FilterError {
  message: string;
  startIndex: number;
  endIndex: number;
}

export interface BooleanParserResponse {
  clauses: BooleanClause[];
  errors: FilterError[];
}

export interface NumberParserResponse {
  clauses: NumberClause[];
  errors: FilterError[];
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

export interface StringParserResponse {
  clauses: StringClause[];
  errors: FilterError[];
  quotes?: QuoteType[]; // List of quote types found in the string.
}
