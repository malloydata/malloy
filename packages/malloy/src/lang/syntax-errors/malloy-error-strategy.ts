/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {InputMismatchException, Parser} from 'antlr4ts';
import {DefaultErrorStrategy} from 'antlr4ts';
import {describeExpected} from './token-names';

function unexpected(offending: string, clause: string | undefined): string {
  return clause
    ? `unexpected ${offending}, expected ${clause}`
    : `unexpected ${offending}`;
}

/**
 * Overrides the three DefaultErrorStrategy methods that paste the parser's
 * expected-token set into the message: tokens are named the way the user types
 * them (via describeExpected) and the set is dropped once too large to be a hint.
 *
 * Fallback only — MalloyParserErrorListener's custom-error cases run first and
 * override these when they match.
 */
export class MalloyErrorStrategy extends DefaultErrorStrategy {
  protected reportInputMismatch(
    recognizer: Parser,
    e: InputMismatchException
  ): void {
    const offending = this.getTokenErrorDisplay(
      e.getOffendingToken(recognizer)
    );
    const expected = e.expectedTokens?.toArray() ?? [];
    const clause = describeExpected(expected, recognizer.vocabulary);
    this.notifyErrorListeners(recognizer, unexpected(offending, clause), e);
  }

  protected reportUnwantedToken(recognizer: Parser): void {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    this.beginErrorCondition(recognizer);
    const t = recognizer.currentToken;
    const offending = this.getTokenErrorDisplay(t);
    const expected = this.getExpectedTokens(recognizer).toArray();
    const clause = describeExpected(expected, recognizer.vocabulary);
    recognizer.notifyErrorListeners(
      unexpected(offending, clause),
      t,
      undefined
    );
  }

  protected reportMissingToken(recognizer: Parser): void {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    this.beginErrorCondition(recognizer);
    const t = recognizer.currentToken;
    const offending = this.getTokenErrorDisplay(t);
    const expected = this.getExpectedTokens(recognizer).toArray();
    const clause = describeExpected(expected, recognizer.vocabulary);
    const msg = clause
      ? `missing ${clause} before ${offending}`
      : `something is missing before ${offending}`;
    recognizer.notifyErrorListeners(msg, t, undefined);
  }
}
