/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Parser, ParserRuleContext, RuleContext, Token} from 'antlr4ts';

export interface ErrorCase {
  // The rule contexts in which to apply this error case.
  // If no context is provided, this error case will apply to all rules.
  ruleContextOptions?: string[];

  // This is the symbol that triggered the error. In general, prefer to use
  // this over `currentToken` when possible.
  offendingSymbol?: number;

  // When you want to match a specific typo, use this to check the text of the
  // offending symbol instead of (or alongside) the numeric token value.
  // Always provide text in all lower case.
  offendingSymbolTextOptions?: string[];

  // The value of the current token when this error rewrite should occur.
  // In general, prefer to use offendingSymbol
  currentToken?: number;

  // The tokens preceding the offending token, in the order they occur.
  // Make the token negative to match all other tokens.
  precedingTokenOptions?: number[][];

  // If provided, at least one of the look ahead sequences would need to match.
  // Make the token negative to match all other tokens.
  // Always provide text in all lower case.
  lookAheadOptions?: (number | string)[][];

  // The error message to show to the user, instead of whatever was default
  // Supports tokenization: ${currentToken}, ${offendingSymbol}, ${previousToken}
  errorMessage: string;

  // The name of the sibling node that must precede this node in the contex of the current
  // rule context. Essentially, the latest child of the current ruleContext.
  // This is generally more robust than using `precedingTokenOptions` because the preceding rule
  // can have many different possible end tokens. However, it can only be used when the error
  // matcher is not looking at the first token of a rule.
  lookbackSiblingRuleOptions?: number[];

  /* Okay the naming here needs some thought. This allows you to assert that the predecessor
   (the latest preceding rule token in the parse tree, following a standard traversal)
   contains this rule. In the following tree diagram, this field would match the rule
   at any of the nodes indicated by MATCH:

               root
              /     \
        sibling     offendingSymbol
        /    \
     ...    MATCH?
            /   \
          ...    MATCH?

    So effectively this allows you to match when the offending token follows a previously completed rule,
    even if that rule may be nested to some extent in the parse tree, and even if it contains subrules.
    This is useful when there is a missing token option that may need to exist between an otherwise
    valid rule and a known token.

    This rule excludes all common ancestors of the match and the offendingSymbol.
  */
  predecessorHasAncestorRule?: number;
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
    const isOffendingSymbolTextMatch =
      !errorCase.offendingSymbolTextOptions ||
      errorCase.offendingSymbolTextOptions.includes(
        offendingSymbol?.text?.toLowerCase() || ''
      );
    if (
      isCurrentTokenMatch &&
      isOffendingSymbolMatch &&
      isRuleContextMatch &&
      isOffendingSymbolTextMatch
    ) {
      if (errorCase.lookbackSiblingRuleOptions) {
        const siblings = parser.ruleContext.children;
        if (!siblings) {
          continue;
        }
        // We use 'any' here because the sibling isn't guaranteed to be a RuleContext,
        // but we only care if it has a ruleIndex. If it doesn't then .includes() won't
        // match anyways.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const precedingRule: RuleContext = siblings[siblings.length - 1] as any;
        if (
          !errorCase.lookbackSiblingRuleOptions.includes(
            precedingRule.ruleIndex
          )
        ) {
          continue;
        }
      }
      // If so, try to check the preceding tokens.
      if (errorCase.precedingTokenOptions) {
        const hasPrecedingTokenMatch = errorCase.precedingTokenOptions.some(
          sequence =>
            checkTokenSequenceMatch(
              parser,
              sequence,
              'lookback',
              offendingSymbol?.tokenIndex
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
              offendingSymbol?.tokenIndex
            )
        );
        if (!hasLookaheadTokenMatch) {
          continue; // Continue to check a different error case
        }
      }

      if (errorCase.predecessorHasAncestorRule) {
        const precedingSibling = parser.ruleContext.children?.[0];

        if (
          !precedingSibling ||
          !doesRightmostBranchContainRule(
            precedingSibling as ParserRuleContext,
            errorCase.predecessorHasAncestorRule
          )
        ) {
          continue;
        }
      }

      // If all cases match, return the custom error message
      let message = errorCase.errorMessage
        .replace('${currentToken}', currentToken.text || '')
        .replace('${offendingSymbol}', offendingSymbol?.text || '');
      try {
        const previousToken = parser.inputStream.LT(-1);
        message = message.replace('${previousToken}', previousToken.text || '');
      } catch (ex) {
        // This shouldn't ever occur, but if it does, just leave the untokenized message.
      }
      return message;
    }
  }

  return '';
};

// Recursively walk the rightmost branch (the path to the most recent token)
// to see whether any of those parse tree nodes match the provided rule number.
const doesRightmostBranchContainRule = (
  root: ParserRuleContext,
  ruleNumber: number,
  depthLimit = 20
): boolean => {
  if (root.ruleIndex === ruleNumber) {
    return true;
  }
  if (depthLimit <= 0) {
    return false;
  }
  const childCount = root.children?.length || 0;
  if (root.children && childCount > 0) {
    const rightmostChild = root.children[root.children.length - 1];
    return doesRightmostBranchContainRule(
      rightmostChild as ParserRuleContext,
      ruleNumber,
      depthLimit - 1
    );
  }
  return false;
};

const checkTokenSequenceMatch = (
  parser: Parser,
  sequence: (number | string)[],
  direction: 'lookahead' | 'lookback',
  anchorTokenPosition: number | undefined
): boolean => {
  try {
    for (let i = 0; i < sequence.length; i++) {
      let streamToken: Token | undefined = undefined;
      if (typeof anchorTokenPosition === 'number') {
        const tokenOffset = direction === 'lookahead' ? i + 1 : -1 * (i + 1);
        streamToken = parser.inputStream.get(anchorTokenPosition + tokenOffset);
      } else {
        // Note: positive lookahead starts at '2' because '1' is the current token.
        const tokenOffset = direction === 'lookahead' ? i + 2 : -1 * (i + 1);
        streamToken = parser.inputStream.LT(tokenOffset);
      }

      if (typeof sequence[i] === 'number') {
        const tokenIndex = sequence[i] as number;
        // Note: negative checking is < -1 becuase Token.EOF is -1, but below
        // that we use negatives to indicate "does-not-match" rules.
        if (tokenIndex >= -1 && streamToken.type !== tokenIndex) {
          return false;
        }

        if (tokenIndex < -1 && streamToken.type === -1 * tokenIndex) {
          return false;
        }
      } else if (typeof sequence[i] === 'string') {
        const tokenText = sequence[i] as string;
        if (tokenText !== streamToken.text?.toLowerCase()) {
          return false;
        }
      }
    }
    return true;
  } catch (ex) {
    // There may not be enough lookback tokens. If so, the case doesn't match.
    return false;
  }
};
