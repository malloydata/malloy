/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {ANTLRErrorListener, Token} from 'antlr4ts';
import {MalloyParser} from '../lib/Malloy/MalloyParser';
import {checkCustomErrorMessage, ErrorCase} from './custom-error-messages';
import {
  MessageLogger,
  MessageCode,
  MessageParameterType,
  LogMessageOptions,
  makeLogMessage,
} from '../parse-log';
import {MalloyTranslation} from '../parse-malloy';

export const commonErrorCases: ErrorCase[] = [
  {
    errorMessage: "'view:' must be followed by '<identifier> is {'",
    ruleContextOptions: ['exploreQueryDef'],
    offendingSymbol: MalloyParser.OCURLY,
    precedingTokenOptions: [[MalloyParser.VIEW], [MalloyParser.COLON]],
  },
  {
    errorMessage: "Missing '}' at '${currentToken}'",
    ruleContextOptions: ['vExpr'],
    offendingSymbol: MalloyParser.VIEW,
    currentToken: MalloyParser.OCURLY,
  },
  {
    errorMessage: "Missing '}' at '${currentToken}'",
    ruleContextOptions: [
      'exploreProperties',
      'queryProperties',
      'exploreStatement',
    ],
    lookAheadOptions: [
      [MalloyParser.EOF],
      [MalloyParser.RUN],
      [MalloyParser.SOURCE],
    ],
  },
];

export class MalloyParserErrorListener implements ANTLRErrorListener<Token> {
  constructor(
    readonly translator: MalloyTranslation,
    readonly messages: MessageLogger
  ) {}

  logError<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: Omit<LogMessageOptions, 'severity'>
  ): T {
    this.messages.log(
      makeLogMessage(code, parameters, {severity: 'error', ...options})
    );
    return code;
  }

  syntaxError(
    recognizer: unknown,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    message: string,
    _e: unknown
  ): void {
    const errAt = {line: line - 1, character: charPositionInLine};
    const range = offendingSymbol
      ? this.translator.rangeFromToken(offendingSymbol)
      : {start: errAt, end: errAt};

    const overrideMessage = checkCustomErrorMessage(
      recognizer as MalloyParser,
      offendingSymbol,
      commonErrorCases
    );
    if (overrideMessage) {
      message = overrideMessage;
    }

    this.logError(
      'syntax-error',
      {message},
      {
        at: {url: this.translator.sourceURL, range},
      }
    );
  }
}
