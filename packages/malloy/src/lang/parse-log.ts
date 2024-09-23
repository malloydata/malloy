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

import {DocumentLocation, FieldValueType} from '../model/malloy_types';

export type LogSeverity = 'error' | 'warn' | 'debug';

/**
 * Default severity is "error"
 */
export interface LogMessage {
  message: string;
  at?: DocumentLocation;
  severity: LogSeverity;
  code: string;
  replacement?: string;
  errorTag?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export interface MessageLogger {
  write(logMsg: LogMessage): void;
  reset(): void;
  getLog(): LogMessage[];
  hasErrors(): boolean;
  noErrors(): boolean;
  empty(): boolean;
}

export class BaseMessageLogger implements MessageLogger {
  private rawLog: LogMessage[] = [];

  getLog(): LogMessage[] {
    return this.rawLog;
  }

  /**
   * Add a message to the log.
   */
  write(logMsg: LogMessage): void {
    this.rawLog.push(logMsg);
  }

  reset(): void {
    this.rawLog.length = 0;
  }

  noErrors(): boolean {
    return !this.hasErrors();
  }

  hasErrors(): boolean {
    const firstError = this.rawLog.find(l => l.severity !== 'warn');
    return firstError !== undefined;
  }

  empty(): boolean {
    return this.rawLog.length === 0;
  }
}

type MessageParameterTypes = {
  'pick-then-does-not-match': {
    thenType: FieldValueType;
    returnType: FieldValueType;
  };
  'pick-else-does-not-match': {
    elseType: FieldValueType;
    returnType: FieldValueType;
  };
  'pick-default-does-not-match': {
    defaultType: FieldValueType;
    returnType: FieldValueType;
  };
  'pick-missing-else': {};
  'pick-missing-value': {};
  'pick-illegal-partial': {};
  'pick-then-must-be-boolean': {thenType: string};
  'experiment-not-enabled': {experimentId: string};
  'experimental-dialect-not-enabled': {dialect: string};
  // Old Style
  'aggregate-source-not-found': string;
  'name-conflict-with-global': string;
  'too-many-arguments-for-time-extraction': string;
  'invalid-type-for-time-extraction': string;
  'invalid-types-for-time-measurement': string;
  'invalid-timeframe-for-time-measurement': string;
  'invalid-time-extraction-unit': string;
  'untranslated-parse-node': string;
  'invalid-aggregate-source': string;
  'missing-aggregate-expression': string;
  'aggregate-of-aggregate': string;
  'bad-join-usage': string;
  'aggregate-traverses-join-cross': string;
  'aggregate-traverses-join-many': string;
  'aggregate-traverses-repeated-relationship': string;
  'alternation-as-value': string;
  'invalid-sql-native-type': string;
  'mismatched-coalesce-types': string;
  'function-not-found': string;
  'case-insensitive-function': string;
  'struct-not-callable': string;
  'connection-not-callable': string;
  'query-not-callable': string;
  'no-matching-function-overload': string;
  'invalid-function-argument-expression-type': string;
  'invalid-function-argument-evaluation-space': string;
  'literal-null-function-argument': string;
  'non-aggregate-function-with-source': string;
  'aggregate-order-by-experiment-not-enabled': string;
  'function-does-not-support-order-by': string;
  'function-does-not-support-limit': string;
  'partition-by-not-found': string;
  'non-scalar-or-aggregate-partition-by': string;
  'sql-functions-experiment-not-enabled': string;
  'invalid-sql-function-argument': string;
  'unsupported-sql-function-interpolation': string;
  'sql-function-interpolation-not-found': string;
  'function-returns-any': string;
  'unsupported-type-for-time-truncation': string;
  'filter-of-non-aggregate': string;
  'aggregate-filter-expression-not-scalar': string;
  'partition-by-of-non-window-function': string;
  'expression-limit-already-specified': string;
  'limit-of-non-aggregate-function': string;
  'order-by-of-non-aggregate-function': string;
  'unsupported-type-for-time-extraction': string;
  'ungroup-of-non-aggregate': string;
  'ungroup-of-ungrouped-aggregate': string;
  'ungroup-field-not-in-output': string;
  'ungroup-with-non-scalar': string;
  'invalid-duration-quantity': string;
  'range-as-value': string;
  'analytic-order-by-missing-field': string;
  'analytic-order-by-not-output': string;
  'analytic-order-by-not-aggregate-or-output': string;
  'aggregate-order-by-not-scalar': string;
  'aggregate-order-by-expression-not-allowed': string;
  'aggregate-order-by-without-field-or-direction': string;
  'partial-as-value': string;
  'top-by-non-aggregate': string;
  'definition-name-conflict': string;
  'invalid-field-in-index-query': string;
  'invalid-wildcard-source': string;
  'wildcard-source-not-found': string;
  'name-conflict-in-wildcard-expansion': string;
  'invalid-parameter-reference': string;
  'parameter-not-found': string;
  'wildcard-source-not-defined': string;
  'unexpected-index-segment': string;
  'accept-parameter': string;
  'except-parameter': string;
  'field-list-edit-not-found': string;
  'unexpected-element-type': string;
  'field-not-found': string;
  'invalid-property-access-in-field-reference': string;
  'parameter-default-does-not-match-declared-type': string;
  'parameter-null-default-without-declared-type': string;
  'parameter-illegal-default-type': string;
  'parameter-missing-default-or-type': string;
  'index-limit-already-specified': string;
  'index-by-already-specified': string;
  'illegal-operation-for-index': string;
  'refinement-of-index-segment': string;
  'incompatible-segment-for-select-refinement': string;
  'illegal-operation-in-select-segment': string;
  'limit-already-specified': string;
  'ordering-already-specified': string;
  'incompatible-segment-for-reduce-refinement': string;
  'query-reference-not-found': string;
  'non-query-used-as-query': string;
  'failed-field-definition': string;
  'null-typed-field-definition': string;
  'invalid-type-for-field-definition': string;
  'circular-reference-in-field-definition': string;
  'output-name-conflict': string;
  'select-of-view': string;
  'select-of-analytic': string;
  'select-of-aggregate': string;
  'aggregate-in-dimension': string;
  'index-of-view': string;
  'index-of-analytic': string;
  'index-of-aggregate': string;
  'analytic-in-dimension': string;
  'scalar-in-measure': string;
  'analytic-in-measure': string;
  'view-in-declare': string;
  'analytic-in-declare': string;
  'calculate-of-view': string;
  'calculate-of-aggregate': string;
  'calculate-of-scalar': string;
  'aggregate-of-view': string;
  'aggregate-of-analytic': string;
  'aggregate-of-scalar': string;
  'group-by-view': string;
  'group-by-analytic': string;
  'group-by-aggregate': string;
  'non-boolean-filter': string;
  'analytic-in-having': string;
  'analytic-in-where': string;
  'aggregate-in-where': string;
  'order-by-not-found-in-output': string;
  'order-by-analytic': string;
  'illegal-index-operation': string;
  'illegal-project-operation': string;
  'illegal-grouping-operation': string;
  'ambiguous-view-type': string;
  'top-by-not-found-in-output': string;
  'top-by-analytic': string;
  'top-by-aggregate': string;
  'top-by-not-in-output': string;
  'source-not-found': string;
  'invalid-source-from-query': string;
  'invalid-source-from-function': string;
  'invalid-source-from-connection': string;
  'invalid-source-from-sql-block': string;
  'unnamed-source-argument': string;
  'duplicate-source-argument': string;
  'source-parameter-not-found': string;
  'missing-source-argument': string;
  'multiple-field-list-edits': string;
  'multiple-primary-keys': string;
  'unexpected-source-property': string;
  'aggregate-in-source-filter': string;
  'invalid-connection-for-sql-source': string;
  'failed-to-fetch-sql-source-schema': string;
  'invalid-sql-source': string;
  'non-top-level-sql-source': string;
  'failed-to-fetch-table-schema': string;
  'invalid-connection-for-table-source': string;
  'join-on-primary-key-type-mismatch': string;
  'join-primary-key-not-found': string;
  'join-with-without-primary-key': string;
  'non-boolean-join-on': string;
  'invalid-rename-with-same-name': string;
  'failed-rename': string;
  'rename-field-not-found': string;
  'invalid-join-source': string;
  'failed-to-compute-arrow-source': string;
  'failed-to-compute-source-from-query': string;
  'failed-to-compute-source-to-extend': string;
  'cannot-use-function-as-query': string;
  'cannot-use-struct-as-query': string;
  'cannot-use-connection-as-query': string;
  'source-or-query-not-found': string;
  'illegal-query-argument': string;
  'cannot-use-function-as-source': string;
  'cannot-use-connection-as-source': string;
  'illegal-refinement-of-source': string;
  'invalid-source-as-query': string;
  'invalid-sql-source-interpolation': string;
  'failed-to-expand-sql-source': string;
  'query-definition-name-conflict': string;
  'query-definition-from-non-query': string;
  'source-definition-name-conflict': string;
  'parameter-name-conflict': string;
  'parameter-shadowing-field': string;
  'invalid-import-url': string;
  'no-translator-for-import': string;
  'name-conflict-on-selective-import': string;
  'selective-import-not-found': string;
  'name-conflict-on-indiscriminate-import': string;
  'failed-import': string;
  'failed-to-compute-output-schema': string;
  'sql-native-not-allowed-in-expression': string;
  'invalid-timeframe-for-time-offset': string;
  'time-comparison-type-mismatch': string;
  'arithmetic-operation-type-mismatch': string;
  'time-offset-type-mismatch': string;
  'unexpected-binary-operator': string;
  'illegal-reference-in-parameter-default': string;
  'aggregate-analytic-in-select': string;
  'refinement-of-raw-query': string;
  'illegal-multistage-refinement-operation': string;
  'illegal-refinement-operation': string;
  'view-not-found': string;
  'refinement-with-joined-view': string;
  'nest-of-joined-view': string;
  'refinement-with-source': string;
  'nest-of-source': string;
  'mismatched-view-types-for-refinement': string;
  'ordering-overridden-in-refinement': string;
  'limit-overridden-in-refinement': string;
  'name-conflict-in-refinement': string;
  'refinement-with-multistage-view': string;
  'foreign-key-in-join-cross': string;
};

export const MESSAGE_FORMATTERS: PartialErrorCodeMessageMap = {
  'pick-then-does-not-match': e => ({
    message: `then type ${e.thenType} does not match return type ${e.returnType}`,
    tag: 'pick-values-must-match',
  }),
  'pick-else-does-not-match': e => ({
    message: `else type ${e.elseType} does not match return type ${e.returnType}`,
    tag: 'pick-values-must-match',
  }),
  'pick-default-does-not-match': e => ({
    message: `default type ${e.defaultType} does not match return type ${e.returnType}`,
    tag: 'pick-values-must-match',
  }),
  'experimental-dialect-not-enabled': e =>
    `Requires compiler flag '##! experimental.dialect.${e.dialect}'`,
  'pick-missing-else': () => "pick incomplete, missing 'else'",
  'pick-missing-value': () => 'pick with no value can only be used with apply',
  'pick-illegal-partial': () =>
    'pick with partial when can only be used with apply',
  'pick-then-must-be-boolean': e =>
    `when expression must be boolean, not ${e.thenType}`,
};

export type MessageCode = keyof MessageParameterTypes;

export type MessageParameterType<T extends MessageCode> =
  MessageParameterTypes[T];

type ErrorCodeMessageMap = {
  [key in keyof MessageParameterTypes]: (
    parameters: MessageParameterType<key>
  ) => MessageInfo;
};

type PartialErrorCodeMessageMap = Partial<ErrorCodeMessageMap>;

type MessageInfo =
  | string
  | {
      message: string;
      severity?: LogSeverity;
      replacement?: string;
      tag?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?: any;
    };

export interface ALogMessage<T extends MessageCode> {
  code: T;
  message: string;
  at?: DocumentLocation;
  data: MessageParameterType<T>;
  severity: LogSeverity;
  errorTag?: string;
  replacement?: string;
}

export type AnyLogMessage = ALogMessage<MessageCode>;

export interface LogMessageOptions {
  replacement?: string;
  at?: DocumentLocation;
  severity?: LogSeverity;
  tag?: string;
}

export function makeLogMessage<T extends MessageCode>(
  code: T,
  parameters: MessageParameterType<T>,
  options?: LogMessageOptions
): LogMessage {
  const formatter = MESSAGE_FORMATTERS[code];
  const info = formatter
    ? formatter(parameters)
    : typeof parameters === 'string'
    ? parameters
    : undefined;
  if (info === undefined) {
    throw new Error('Attempted to log data without code.');
  }
  const template = typeof info === 'string' ? {message: info} : info;
  const data =
    template.data ?? typeof parameters === 'string' ? {} : parameters;
  return {
    code,
    data,
    message: template.message,
    severity: options?.severity ?? template.severity ?? 'error',
    errorTag: options?.tag ?? template.tag,
    replacement: options?.replacement ?? template.replacement,
    at: options?.at,
  };
}
