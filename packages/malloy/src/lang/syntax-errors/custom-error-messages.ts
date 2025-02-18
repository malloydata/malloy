/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
/* eslint-disable no-console */

import {Parser, Token} from 'antlr4ts';
import {MalloyParser} from '../lib/Malloy/MalloyParser';

interface ErrorCase {
  // The rule contexts in which to apply this error case.
  // If no context is provided, this error case will apply to all rules.
  ruleContextOptions?: string[];
  // This is the symbol that triggered the error. In general, prefer to use
  // this over `offendingToken` when possible.
  offendingSymbol?: number;
  // The value of the current token when this error rewrite should occur.
  // In general, prefer to use offendingSymbol
  currentToken?: number;
  // The tokens preceding the offending token, in the order they occur
  precedingTokens?: number[];
  // The error message to show to the user, instead of whatever was default
  errorMessage: string;
}

const commonErrorCases: ErrorCase[] = [
  {
    errorMessage: "'view:' must be followed by '<identifier> is {'",
    ruleContextOptions: ['exploreQueryDef'],
    offendingSymbol: MalloyParser.OCURLY,
    precedingTokens: [MalloyParser.VIEW, MalloyParser.COLON],
  },
  {
    errorMessage: "Missing '}' at 'view'",
    ruleContextOptions: ['vExpr'],
    offendingSymbol: MalloyParser.VIEW,
    currentToken: MalloyParser.OCURLY,
  },
];

export const checkCustomErrorMessage = (
  parser: Parser,
  offendingSymbol: Token | undefined
): string => {
  const currentRuleName = parser.getRuleInvocationStack()[0];
  const currentToken = parser.currentToken;

  for (const errorCase of commonErrorCases) {
    // Check to see if the initial conditions match
    if (
      (currentToken.type === errorCase.currentToken ||
        offendingSymbol?.type === errorCase.offendingSymbol) &&
      (!errorCase.ruleContextOptions ||
        errorCase.ruleContextOptions.includes(currentRuleName))
    ) {
      // If so, try to check the preceding tokens.
      if (errorCase.precedingTokens) {
        try {
          for (let i = 0; i < errorCase.precedingTokens.length; i++) {
            const lookbackToken = parser.inputStream.LA(-1 * (i + 1));
            if (lookbackToken !== errorCase.precedingTokens[i]) {
              continue;
            }
          }
        } catch (ex) {
          // There may not be enough lookback tokens. If so, the case doesn't match.
          continue;
        }
      }

      // If all cases match, return the custom error message
      return errorCase.errorMessage;
    }
  }

  return '';
};
