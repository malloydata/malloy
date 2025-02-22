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

export type StringOperator =
  | 'EMPTY'
  | 'NOTEMPTY'
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

export type StringValue = string | null;

export interface StringClause {
  operator: StringOperator;
  values: StringValue[];
  quotes?: QuoteType[]; // List of quote types found in the string.
}

export type BooleanOperator = 'TRUE' | 'FALSE' | 'NULL' | 'NOTNULL';

export interface BooleanClause {
  operator: BooleanOperator;
}

export type NumberClause = NumberCondition | NumberRange;

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
export interface StringParserResponse {
  clauses: StringClause[];
  errors: FilterError[];
}
