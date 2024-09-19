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
  DocumentLocation,
  EvalSpace,
  ExpressionType,
  FieldValueType,
  expressionIsScalar,
} from '../model/malloy_types';

export type LogSeverity = 'error' | 'warn' | 'debug';

/**
 * Default severity is "error"
 */
export interface LogMessage {
  message: string;
  at?: DocumentLocation;
  severity: LogSeverity;
  errorTag?: string;
  replacement?: string;
}

export interface MessageLogger {
  logMessage(logMsg: LogMessage): void;
  reset(): void;
  getLog(): LogMessage[];
  hasErrors(): boolean;
  noErrors(): boolean;
  empty(): boolean;
}

type MessageDataTypes = {
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
  'parser-error': {message: string};
  'internal-translator-error': {message: string};
  'experiment-not-enabled': {experimentId: string};
  'sql-functions-experiment-not-enabled': {name: string};
  'aggregate-order-by-experiment-not-enabled': {};
  'global-namespace-redefine': {name: string};
  'experimental-dialect-not-enabled': {dialect: string};
  'pick-missing-else': {};
  'pick-missing-value': {};
  'pick-illegal-partial': {};
  'pick-then-must-be-boolean': {thenType: string};
  'malformed-import-url': {url: string};
  'untranslated-parse-node': {};
  'import-parsed-as-non-malloy-document': {url: string};
  'syntax-error': {message: string};
  'parse-exception': {message: string};
  'import-error': {message: string; url: string};
  'cannot-compute-full-import-url': {message: string};
  'function-not-found': {name: string};
  'called-non-function': {
    type: 'struct' | 'connection' | 'query';
    name: string;
  };
  'function-case-does-not-match': {name: string};
  'invalid-aggregate-source': {type: FieldValueType};
  'aggregate-source-not-found': {source: string};
  'no-matching-overload': {name: string; types: FieldValueType[]};
  'mismatched-function-argument-expression-type': {
    functionName: string;
    parameterName: string;
    argumentIndex: number;
    maximumAllowedExpressionType: ExpressionType;
    actualExpressionType: ExpressionType;
  };
  'mismatched-function-argument-evaluation-space': {
    functionName: string;
    parameterName: string;
    argumentIndex: number;
    maximumAllowedEvaluationSpace: EvalSpace;
    actualEvaluationSpace: EvalSpace;
  };
  'function-argument-must-not-be-literal-null': {
    functionName: string;
    parameterName: string;
    argumentIndex: number;
  };
  'non-aggregate-function-called-with-source': {
    name: string;
    types: FieldValueType[];
  };
  'illegal-function-order-by': {name: string};
  'illegal-function-limit': {name: string};
  'partition-by-not-found': {name: string};
  'partition-by-must-be-scalar-or-aggregate': {};
  'invalid-sql-expression-string': {sqlFunctionName: string};
  'unsupported-sql-function-dotted-interpolation': {
    unsupportedInterpolations: string[];
  };
  'sql-function-interpolation-not-found': {name: string};
  'invalid-function-return-type': {type: FieldValueType; name: string};
};

export const MESSAGE_FORMATTERS: ErrorCodeMessageMap = {
  'pick-then-does-not-match': e => ({
    error: `then type ${e.thenType} does not match return type ${e.returnType}`,
    tag: 'pick-values-must-match',
  }),
  'pick-else-does-not-match': e =>
    `else type ${e.elseType} does not match return type ${e.returnType}`,
  'pick-default-does-not-match': e =>
    `default type ${e.defaultType} does not match return type ${e.returnType}`,
  'parser-error': e => `Parse error: ${e.message}`,
  'internal-translator-error': e =>
    `INTERNAL ERROR IN TRANSLATION: ${e.message}`,
  'experiment-not-enabled': e =>
    `Experimental flag '${e.experimentId}' is not set, feature not available`,
  'sql-functions-experiment-not-enabled': e =>
    `Cannot use sql_function \`${e.name}\`; use \`sql_functions\` experiment to enable this behavior`,
  'aggregate-order-by-experiment-not-enabled': () =>
    'Enable experiment `aggregate_order_by` to use `order_by` with an aggregate function',
  'global-namespace-redefine': e =>
    `Cannot redefine '${e.name}', which is in global namespace`,
  'experimental-dialect-not-enabled': e =>
    `Requires compiler flag '##! experimental.dialect.${e.dialect}'`,
  'pick-missing-else': () => "pick incomplete, missing 'else'",
  'pick-missing-value': () => 'pick with no value can only be used with apply',
  'pick-illegal-partial': () =>
    'pick with partial when can only be used with apply',
  'pick-then-must-be-boolean': e =>
    `when expression must be boolean, not ${e.thenType}`,
  'malformed-import-url': e => `Malformed URL '${e.url}'"`,
  'untranslated-parse-node': () =>
    'INTERNAL COMPILER ERROR: Untranslated parse node',
  'import-parsed-as-non-malloy-document': e =>
    `'${e.url}' did not parse to malloy document`,
  'syntax-error': e => e.message,
  'parse-exception': e => `Malloy internal parser exception [${e.message}]`,
  'import-error': e =>
    e.message.includes(e.url)
      ? `import error: ${e.message}`
      : `import '${e.url}' error: ${e.message}`,
  'cannot-compute-full-import-url': e =>
    `Could not compute full path URL: ${e.message}`,
  'function-not-found': e =>
    `Unknown function '${e.name}'. Use '${e.name}!(...)' to call a SQL function directly.`,
  'called-non-function': e =>
    `Cannot call '${e.name}', which is of type ${e.type}`,
  'function-case-does-not-match': e => ({
    warn: `Case insensitivity for function names is deprecated, use '${e.name}' instead`,
  }),
  'invalid-aggregate-source': e => `Aggregate source cannot be a ${e.type}`,
  'aggregate-source-not-found': e => `Reference to undefined value ${e.source}`,
  'no-matching-overload': e =>
    `No matching overload for function ${e.name}(${e.types.join(', ')})`,
  'mismatched-function-argument-expression-type': e => {
    const allowed = expressionIsScalar(e.maximumAllowedExpressionType)
      ? 'scalar'
      : 'scalar or aggregate';
    return `Parameter ${e.argumentIndex + 1} ('${e.parameterName}') of ${
      e.functionName
    } must be ${allowed}, but received ${e.actualExpressionType}`;
  },
  'mismatched-function-argument-evaluation-space': e => {
    const allowed =
      e.maximumAllowedEvaluationSpace === 'literal'
        ? 'literal'
        : e.maximumAllowedEvaluationSpace === 'constant'
        ? 'literal or constant'
        : 'literal, constant or output';
    return `Parameter ${e.argumentIndex + 1} ('${e.parameterName}') of ${
      e.functionName
    } must be ${allowed}, but received ${e.actualEvaluationSpace}`;
  },
  'function-argument-must-not-be-literal-null': e =>
    `Parameter ${e.argumentIndex + 1} ('${e.parameterName}') of ${
      e.functionName
    } must not be a literal null`,
  'non-aggregate-function-called-with-source': e =>
    `Cannot call function ${e.name}(${e.types.join(', ')}) with source`,
  'illegal-function-order-by': e =>
    `Function \`${e.name}\` does not support \`order_by\``,
  'illegal-function-limit': e => `Function ${e.name} does not support limit`,
  'partition-by-not-found': e => `${e.name} is not defined`,
  'partition-by-must-be-scalar-or-aggregate': () =>
    'Partition expression must be scalar or aggregate',
  'invalid-sql-expression-string': e =>
    `Invalid string literal for \`${e.sqlFunctionName}\``,
  'unsupported-sql-function-dotted-interpolation': e =>
    (e.unsupportedInterpolations.length === 1
      ? `'.' paths are not yet supported in sql interpolations, found ${e.unsupportedInterpolations[0]}`
      : `'.' paths are not yet supported in sql interpolations, found (${e.unsupportedInterpolations.join(
          ', '
        )})`) +
    '. See LookML ${...} documentation at https://cloud.google.com/looker/docs/reference/param-field-sql#sql_for_dimensions',
  'sql-function-interpolation-not-found': e =>
    `Invalid interpolation: ${e.name} not found`,
  'invalid-function-return-type': e =>
    `Invalid return type ${e.type} for function '${e.name}'`,
};

export type MessageCode = keyof MessageDataTypes;

export type MessageDataType<T extends MessageCode> = MessageDataTypes[T];

type ErrorCodeMessageMap = {
  [key in keyof MessageDataTypes]: (data: MessageDataType<key>) => MessageInfo;
};

type MessageInfo =
  | string
  | {warn: string; tag?: string}
  | {error: string; tag?: string};

export interface ALogMessage<T extends MessageCode> {
  code: T;
  message: string;
  at?: DocumentLocation;
  data: MessageDataType<T>;
  severity: LogSeverity;
  errorTag?: string;
  replacement?: string;
}

export type AnyLogMessage = ALogMessage<MessageCode>;

export function makeLogMessage<T extends MessageCode>(
  code: T,
  data: MessageDataType<T>,
  extras?: {
    replacement?: string;
    at?: DocumentLocation;
  }
): ALogMessage<T> {
  const info = MESSAGE_FORMATTERS[code](data);
  const message =
    typeof info === 'string' ? info : 'warn' in info ? info.warn : info.error;
  const severity =
    typeof info === 'string' ? 'error' : 'warn' in info ? 'warn' : 'error';
  const errorTag = typeof info === 'string' ? undefined : info.tag;
  const replacement = extras?.replacement;
  const at = extras?.at;
  return {
    code,
    data,
    message,
    severity,
    errorTag,
    replacement,
    at,
  };
}

export class MessageLog implements MessageLogger {
  private rawLog: AnyLogMessage[] = [];

  getLog(): AnyLogMessage[] {
    return this.rawLog;
  }

  /**
   * Add a message to the log.
   *
   * If the messsage ends with '[tag]', the tag is removed and stored in the `errorTag` field.
   * @param logMsg Message possibly containing an error tag
   */
  logMessage(logMsg: AnyLogMessage): void {
    const msg = logMsg.message;
    // github security is worried about msg.match(/^(.+)\[(.+)\]$/ because if someone
    // could craft code with a long varibale name which would blow up that regular expression
    if (msg.endsWith(']')) {
      const tagStart = msg.lastIndexOf('[');
      if (tagStart > 0) {
        logMsg.message = msg.slice(0, tagStart);
        logMsg.errorTag = msg.slice(tagStart + 1, -1);
      }
    }
    this.rawLog.push(logMsg);
  }

  log<T extends MessageCode>(
    code: T,
    data: MessageDataType<T>,
    extras?: {
      replacement?: string;
      at?: DocumentLocation;
    }
  ): MessageCode {
    this.logMessage(makeLogMessage(code, data, extras));
    return code;
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
