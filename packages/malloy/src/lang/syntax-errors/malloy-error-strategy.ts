/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {DefaultErrorStrategy, Parser} from 'antlr4ts';
import {IntervalSet} from 'antlr4ts/misc/IntervalSet';
import {MalloyParser} from '../lib/Malloy/MalloyParser';

// Set of tokens that should only appear outside of any blocks
export const ROOT_LEVEL_TOKEN_SET = [
  MalloyParser.EOF,
  MalloyParser.RUN,
  MalloyParser.SOURCE,
];

// A list of rules end with a CCURLY token, for which we want to detect a
// missing closing curly brace and provide a helpful error message when
// possible.
const CLOSING_CURLY_RULE_NAMES = [
  'exploreProperties',
  'queryProperties',
  // 'includeBlock',
  // 'queryExtendStatementList',
  // 'fieldProperties',
  // 'starQualified',
  // TODO: To support this rule, we'd need to separate it out from the fieldExp alternatives list
  // and give it a name. Would this interfere with the AST Walker or IR construction?
  // exprLiteralRecord (fieldExpr case: ` OCURLY recordElement (COMMA recordElement)* CCURLY`)
];

// Declarative interface for defining custom error cases.
// These cases are checked many times during parsing, and so should only be
// used for significant error cases that are not well detected by the default
// error strategy. For errors that are detected, but need a custom message,
// update custom-error-messages.ts instead.
interface CustomErrorStrategyCase {
  errorMessageTemplate: string;
  ruleContextOptions: string[];

  // A list of
  lookAheadOptions: number[][];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const customErrorCases: CustomErrorStrategyCase[] = [
  {
    errorMessageTemplate: "Missing '}' at '${currentTokenName}'",
    ruleContextOptions: ['exploreProperties', 'queryProperties'],
    lookAheadOptions: [
      [MalloyParser.EOF],
      [MalloyParser.RUN],
      [MalloyParser.SOURCE],
    ],
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
    const currentRuleName = parser.getRuleInvocationStack()[0];
    if (CLOSING_CURLY_RULE_NAMES.includes(currentRuleName)) {
      const expected: IntervalSet = this.getExpectedTokens(parser);
      if (expected.contains(MalloyParser.CCURLY)) {
        const lookAhead = parser.inputStream.LA(1);
        if (ROOT_LEVEL_TOKEN_SET.includes(lookAhead)) {
          // Error here is that a curly brace is missing

          const tokenName = parser.vocabulary.getDisplayName(lookAhead);
          parser.notifyErrorListeners(
            `Missing '}' at '${tokenName}'`,
            parser.currentToken,
            undefined
          );

          return;
        }
      }
    }

    super.sync(parser);
  }

  // override recoverInline(parser: Parser) {
  //   const token = parser.currentToken;
  //   const displayToken = parser.vocabulary.getDisplayName(token.type);
  //   console.log('Recover Inline hit at token: ', displayToken);

  //   return super.recoverInline(parser);
  // }
}
