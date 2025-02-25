/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Parser, Token} from 'antlr4ts';

export interface ErrorCase {
  // The rule contexts in which to apply this error case.
  // If no context is provided, this error case will apply to all rules.
  ruleContextOptions?: string[];
  // This is the symbol that triggered the error. In general, prefer to use
  // this over `offendingToken` when possible.
  offendingSymbol?: number;
  // The value of the current token when this error rewrite should occur.
  // In general, prefer to use offendingSymbol
  currentToken?: number;

  // The tokens preceding the offending token, in the order they occur.
  // Make the token negative to match all other tokens.
  precedingTokenOptions?: number[][];

  // If provided, at least one of the look ahead sequences would need to match.
  // Make the token negative to match all other tokens.
  lookAheadOptions?: number[][];

  // The error message to show to the user, instead of whatever was default
  // Supports tokenization: ${currentToken}
  errorMessage: string;

  // By default, the error checker does lookahead and lookback based on the curentToken
  // (the parser's position in the inputStream). However, for many error cases it is
  // better to check from the offending token and not from the current token, since the
  // error may have been hit while the ATN was looking ahead for alternatives.
  // Note: In most cases, if this option is enabled, the 'ruleContext' may be a parser rule
  // much higher in the tree than you would expect, and may be better to leave off entirely.
  // Note: You can use this option without actually specifying the offendingSymbol match.
  lookbackFromOffendingSymbol?: boolean;
}

export const checkCustomErrorMessage = (
  parser: Parser,
  offendingSymbol: Token | undefined,
  errorCases: ErrorCase[]
): string => {
  const currentRuleName = parser.getRuleInvocationStack()[0];
  const currentToken = parser.currentToken;

  for (const errorCase of errorCases) {
    // Check to see if the initial conditions match
    const isCurrentTokenMatch =
      !errorCase.currentToken || currentToken.type === errorCase.currentToken;
    const isOffendingSymbolMatch =
      !errorCase.offendingSymbol ||
      offendingSymbol?.type === errorCase.offendingSymbol;
    const isRuleContextMatch =
      !errorCase.ruleContextOptions ||
      errorCase.ruleContextOptions.includes(currentRuleName);
    if (isCurrentTokenMatch && isOffendingSymbolMatch && isRuleContextMatch) {
      // If so, try to check the preceding tokens.
      if (errorCase.precedingTokenOptions) {
        const hasPrecedingTokenMatch = errorCase.precedingTokenOptions.some(
          sequence =>
            checkTokenSequenceMatch(
              parser,
              sequence,
              'lookback',
              errorCase.lookbackFromOffendingSymbol
                ? offendingSymbol?.tokenIndex
                : undefined
            )
        );
        if (!hasPrecedingTokenMatch) {
          continue; // Continue to check a different error case
        }
      }
      if (errorCase.lookAheadOptions) {
        const hasLookaheadTokenMatch = errorCase.lookAheadOptions.some(
          sequence =>
            checkTokenSequenceMatch(
              parser,
              sequence,
              'lookahead',
              errorCase.lookbackFromOffendingSymbol
                ? offendingSymbol?.tokenIndex
                : undefined
            )
        );
        if (!hasLookaheadTokenMatch) {
          continue; // Continue to check a different error case
        }
      }

      // If all cases match, return the custom error message
      const message = errorCase.errorMessage.replace(
        '${currentToken}',
        offendingSymbol?.text || currentToken.text || ''
      );
      return message;
    }
  }

  return '';
};

const checkTokenSequenceMatch = (
  parser: Parser,
  sequence: number[],
  direction: 'lookahead' | 'lookback',
  anchorTokenPosition: number | undefined
): boolean => {
  try {
    for (let i = 0; i < sequence.length; i++) {
      let streamToken: number | undefined = undefined;
      if (typeof anchorTokenPosition === 'number') {
        const tokenOffset = direction === 'lookahead' ? i + 1 : -1 * (i + 1);
        streamToken = parser.inputStream.get(
          anchorTokenPosition + tokenOffset
        ).type;
      } else {
        // Note: positive lookahead starts at '2' because '1' is the current token.
        const tokenOffset = direction === 'lookahead' ? i + 2 : -1 * (i + 1);
        streamToken = parser.inputStream.LA(tokenOffset);
      }

      // Note: negative checking is < -1 becuase Token.EOF is -1, but below
      // that we use negatives to indicate "does-not-match" rules.
      if (sequence[i] >= -1 && streamToken !== sequence[i]) {
        return false;
      }

      if (sequence[i] < -1 && streamToken === -1 * sequence[i]) {
        return false;
      }
    }
    return true;
  } catch (ex) {
    // There may not be enough lookback tokens. If so, the case doesn't match.
    return false;
  }
};
