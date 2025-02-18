/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {DefaultErrorStrategy, Parser} from 'antlr4ts';
import {MalloyParser} from '../lib/Malloy/MalloyParser';
import {checkCustomErrorMessage, ErrorCase} from './custom-error-messages';

const customErrorCases: ErrorCase[] = [
  {
    errorMessage: "Missing '}' at '${currentToken}'",
    ruleContextOptions: ['exploreProperties', 'queryProperties'],
    lookAheadOptions: [
      [MalloyParser.EOF],
      [MalloyParser.RUN],
      [MalloyParser.SOURCE],
    ],
  },
  {
    errorMessage: "Missing '{' after 'extend'",
    currentToken: MalloyParser.EXTEND,
    ruleContextOptions: ['sqExpr'],
    lookAheadOptions: [[-MalloyParser.OCURLY]],
  },
];

/**
 * Custom error strategy for the Malloy Parser. This strategy attempts to
 * detect known cases where the default error strategy results in an unhelpful
 * parse tree or misleading messages. In any cases not explicitly handled, this
 * custom error strategy will fall back to the default error strategy.
 *
 * For more details, read the documentation in DefaultErrorStrategy.d.ts
 * or reference the superclass at:
 * https://github.com/tunnelvisionlabs/antlr4ts/blob/master/src/DefaultErrorStrategy.ts
 */
export class MalloyErrorStrategy extends DefaultErrorStrategy {
  override sync(parser: Parser) {
    const interceptedErrorMessage = checkCustomErrorMessage(
      parser as MalloyParser,
      undefined,
      customErrorCases
    );
    if (interceptedErrorMessage) {
      parser.notifyErrorListeners(
        interceptedErrorMessage,
        parser.currentToken,
        undefined
      );

      return;
    }

    super.sync(parser);
  }
}
