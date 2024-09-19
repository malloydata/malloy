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

import {DocumentLocation} from '../model/malloy_types';

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
  log(logMsg: LogMessage): void;
  reset(): void;
  getLog(): LogMessage[];
  hasErrors(): boolean;
  noErrors(): boolean;
  empty(): boolean;
}

type MessageDataTypes = {
  'pick-then-does-not-match': {thenType: string; returnType: string};
  'pick-else-does-not-match': {elseType: string; returnType: string};
  'pick-default-does-not-match': {defaultType: string; returnType: string};
  'parser-error': {message: string};
  'internal-translator-error': {message: string};
  'experiment-not-enabled': {experimentId: string};
  'global-namespace-redefine': {name: string};
  'experimental-dialect-not-enabled': {dialect: string};
  'pick-missing-else': null;
  'pick-missing-value': null;
  'pick-illegal-partial': null;
  'pick-then-must-be-boolean': {thenType: string};
};

export type MessageCode = keyof MessageDataTypes;

export type MessageDataType<T extends MessageCode> = MessageDataTypes[T];

export type MessageCodeWithNullDataType<T extends MessageCode> =
  MessageDataType<T> extends null ? T : never;

type ErrorCodeMessageMap = {
  [key in keyof MessageDataTypes]: (data: MessageDataType<key>) => MessageInfo;
};

type MessageInfo =
  | string
  | {warn: string; tag?: string}
  | {error: string; tag?: string};

export const messages2: ErrorCodeMessageMap = {
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
};

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

export function makeMessage<T extends MessageCode>(
  code: T,
  data: MessageDataType<T>,
  extras?: {
    replacement?: string;
  }
): ALogMessage<T> {
  const info = messages2[code](data);
  const message =
    typeof info === 'string' ? info : 'warn' in info ? info.warn : info.error;
  const severity =
    typeof info === 'string' ? 'error' : 'warn' in info ? 'warn' : 'error';
  const errorTag = typeof info === 'string' ? undefined : info.tag;
  const replacement = extras?.replacement;
  return {
    code,
    data,
    message,
    severity,
    errorTag,
    replacement,
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
  log(logMsg: AnyLogMessage): void {
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
