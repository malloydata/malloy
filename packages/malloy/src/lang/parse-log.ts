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

import {
  compositeFieldUsageIsPlural,
  formatCompositeFieldUsages,
} from '../model/composite_source_utils';
import type {
  CompositeFieldUsage,
  DocumentLocation,
  ExpressionValueType,
} from '../model/malloy_types';
import type {EventStream} from '../runtime_types';

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
  log(logMsg: LogMessage): void;
  reset(): void;
  getLog(): LogMessage[];
  hasErrors(): boolean;
  noErrors(): boolean;
  empty(): boolean;
}

export class BaseMessageLogger implements MessageLogger {
  private rawLog: LogMessage[] = [];

  constructor(private readonly eventStream: EventStream | null) {}

  getLog(): LogMessage[] {
    return this.rawLog;
  }

  /**
   * Add a message to the log.
   */
  log(logMsg: LogMessage): void {
    this.rawLog.push(logMsg);
    this.eventStream?.emit(`translation-${logMsg.severity}`, {
      code: logMsg.code,
      data: logMsg.data,
      message: logMsg.message,
    });
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
  'pick-type-does-not-match': {
    pickType: ExpressionValueType;
    returnType: ExpressionValueType;
  };
  'pick-else-type-does-not-match': {
    elseType: ExpressionValueType;
    returnType: ExpressionValueType;
  };
  'pick-default-type-does-not-match': {
    defaultType: ExpressionValueType;
    returnType: ExpressionValueType;
  };
  'pick-missing-else': {};
  'pick-missing-value': {};
  'pick-illegal-partial': {};
  'pick-when-must-be-boolean': {whenType: ExpressionValueType};
  'pick-non-atomic-type': string;
  'experiment-not-enabled': {experimentId: string};
  'experimental-dialect-not-enabled': {dialect: string};
  'sql-native-not-allowed-in-expression': {
    rawType: string | undefined;
  };
  'ambiguous-view-type': {};
  'failed-to-compute-absolute-import-url': string;
  'import-error': {message: string; url: string};
  'parsed-non-malloy-document': {url: string};
  'parse-exception': {message: string};
  'syntax-error': {message: string};
  'internal-translator-error': {message: string};
  'invalid-timezone': {timezone: string};
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
  'call-of-non-function': string;
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
  'invalid-composite-source-input': string;
  'invalid-composite-field-usage': {
    newUsage: CompositeFieldUsage;
    allUsage: CompositeFieldUsage;
  };
  'empty-composite-source': string;
  'unnecessary-composite-source': string;
  'composite-source-atomic-fields-only': string;
  'composite-source-connection-mismatch': string;
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
  'top-by-not-found-in-output': string;
  'top-by-analytic': string;
  'top-by-aggregate': string;
  'top-by-not-in-output': string;
  'source-not-found': string;
  'invalid-source-from-query': string;
  'invalid-source-from-function': string;
  'invalid-source-from-connection': string;
  'invalid-source-source': string;
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
  'cannot-use-as-query': string;
  'source-or-query-not-found': string;
  'illegal-query-argument': string;
  'cannot-use-struct-as-source': string;
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
  'expression-type-error': string;
  'unexpected-statement-in-translation': string;
  'illegal-query-interpolation-outside-sql-block': string;
  'percent-terminated-query-interpolation': string;
  'failed-to-parse-time-literal': string;
  'table-function': string;
  'missing-on-in-join-many': string;
  'foreign-key-in-join-many': string;
  'join-statement-in-view': string;
  'unknown-matrix-operation': string;
  'declare': string;
  'query-in-source': string;
  'invalid-reference-only-aggregation': string;
  'project': string;
  'top-by': string;
  'anonymous-query': string;
  'anonymous-nest': string;
  'count-expression-with-locality': string;
  'invalid-symmetric-aggregate': string;
  'invalid-asymmetric-aggregate': string;
  'aggregate-parse-error': string;
  'wildcard-in-aggregate': string;
  'unexpected-malloy-type': string;
  'failed-to-parse-function-name': string;
  'orphaned-object-annotation': string;
  'misplaced-model-annotation': string;
  'unexpected-non-source-query-expression-node': string;
  'sql-not-like': string;
  'sql-like': string;
  'sql-is-not-null': string;
  'sql-is-null': string;
  'illegal-record-property-type': string;
  'record-literal-needs-keys': string;
  'not-yet-implemented': string;
  'sql-case': string;
  'case-then-type-does-not-match': {
    thenType: ExpressionValueType;
    returnType: ExpressionValueType;
  };
  'case-else-type-does-not-match': {
    elseType: ExpressionValueType;
    returnType: ExpressionValueType;
  };
  'case-when-must-be-boolean': {whenType: ExpressionValueType};
  'case-when-type-does-not-match': {
    whenType: ExpressionValueType;
    valueType: ExpressionValueType;
  };
  'or-choices-only': string;
  'sql-in': string;
  'dialect-cast-unsafe-only': string;
  'field-not-accessible': string;
  'cannot-expand-access': string;
  'conflicting-access-modifier': string;
  'accept-except-not-compatible-with-include': string;
  'already-renamed': string;
  'wildcard-except-redundant': string;
  'already-used-star-in-include': string;
  'include-after-exclude': string;
  'duplicate-include': string;
  'exclude-after-include': string;
  'cannot-rename-non-field': string;
  'array-values-incompatible': string;
  'invalid-resolved-type-for-array': string;
  'generic-not-resolved': string;
  'cannot-tag-include-except': string;
  'unsupported-path-in-include': string;
  'wildcard-include-rename': string;
  'literal-string-newline': string;
  'filter-expression-type': string;
  'invalid-malloy-query-document': string;
};

export const MESSAGE_FORMATTERS: PartialErrorCodeMessageMap = {
  'pick-type-does-not-match': e => ({
    message: `pick type \`${e.pickType}\` does not match return type \`${e.returnType}\``,
    tag: 'pick-values-must-match',
  }),
  'pick-else-type-does-not-match': e => ({
    message: `else type \`${e.elseType}\` does not match return type \`${e.returnType}\``,
    tag: 'pick-values-must-match',
  }),
  'pick-default-type-does-not-match': e => ({
    message: `default type \`${e.defaultType}\` does not match return type \`${e.returnType}\``,
    tag: 'pick-values-must-match',
  }),
  'experimental-dialect-not-enabled': e =>
    `Requires compiler flag '##! experimental.dialect.${e.dialect}'`,
  'pick-missing-else': "pick incomplete, missing 'else'",
  'pick-missing-value': 'pick with no value can only be used with apply',
  'pick-illegal-partial': 'pick with partial when can only be used with apply',
  'pick-when-must-be-boolean': e =>
    `when expression must be boolean, not ${e.whenType}`,
  'sql-native-not-allowed-in-expression': e => ({
    message: `Unsupported SQL native type '${e.rawType}' not allowed in expression`,
    tag: 'unsupported-sql-native-type-not-allowed-in-expression',
  }),
  'experiment-not-enabled': e =>
    `Experimental flag \`${e.experimentId}\` is not set, feature not available`,
  'ambiguous-view-type':
    "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)",
  'import-error': e =>
    e.message.includes(e.url)
      ? `import error: ${e.message}`
      : `import '${e.url}' error: ${e.message}`,
  'parsed-non-malloy-document': e =>
    `'${e.url}' did not parse to malloy document`,
  'parse-exception': e => `Malloy internal parser exception [${e.message}]`,
  'syntax-error': e => e.message,
  'internal-translator-error': e => `Internal Translator Error: ${e.message}`,
  'invalid-timezone': e => `Invalid timezone: ${e.timezone}`,
  'case-then-type-does-not-match': e =>
    `Case then type ${e.thenType} does not match return type ${e.returnType}`,
  'case-else-type-does-not-match': e =>
    `Case else type ${e.elseType} does not match return type ${e.returnType}`,
  'case-when-must-be-boolean': e =>
    `Case when expression must be boolean, not ${e.whenType}`,
  'case-when-type-does-not-match': e =>
    `Case when type ${e.whenType} does not match value type ${e.valueType}`,
  'invalid-composite-field-usage': e => {
    const formattedNewCompositeUsage = formatCompositeFieldUsages(e.newUsage);
    const formattedAllCompositeUsage = formatCompositeFieldUsages(e.allUsage);
    const pluralUse = compositeFieldUsageIsPlural(e.newUsage) ? 's' : '';
    return `This operation uses composite field${pluralUse} ${formattedNewCompositeUsage}, resulting in invalid usage of the composite source, as there is no composite input source which defines all of ${formattedAllCompositeUsage}`;
  },
};

export type MessageCode = keyof MessageParameterTypes;

export type MessageParameterType<T extends MessageCode> =
  MessageParameterTypes[T];

type MessageCodeAndParameters<T extends MessageCode> = {
  code: T;
  parameters: MessageParameterType<T>;
};

export type AnyMessageCodeAndParameters = MessageCodeAndParameters<MessageCode>;

type MessageFormatter<T extends MessageCode> =
  | MessageInfo
  | ((parameters: MessageParameterType<T>) => MessageInfo);

type ErrorCodeMessageMap = {
  [key in keyof MessageParameterTypes]: MessageFormatter<key>;
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
  const format: MessageFormatter<T> | undefined = MESSAGE_FORMATTERS[code];
  const info = format
    ? format instanceof Function
      ? format(parameters)
      : format
    : typeof parameters === 'string'
    ? parameters
    : undefined;
  if (info === undefined) {
    throw new Error(`No message formatter for error code \`${code}\`.`);
  }
  const template = typeof info === 'string' ? {message: info} : info;
  const data =
    template.data ?? typeof parameters === 'string' ? null : parameters;
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
