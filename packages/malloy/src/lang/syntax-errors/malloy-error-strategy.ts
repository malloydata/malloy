/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  InputMismatchException,
  NoViableAltException,
  Parser,
} from 'antlr4ts';
import {DefaultErrorStrategy} from 'antlr4ts';
import {describeExpected, reservedNameMessage} from './token-names';

function unexpected(offending: string, clause: string | undefined): string {
  return clause
    ? `unexpected ${offending}, expected ${clause}`
    : `unexpected ${offending}`;
}

/**
 * Overrides the DefaultErrorStrategy methods that paste the parser's
 * expected-token set into the message: tokens are named the way the user types
 * them (via describeExpected) and the set is dropped once too large to be a hint.
 *
 * Each path also checks reservedNameMessage first, so a reserved word used where
 * a name was expected (`group_by: year`) says "quote it".
 *
 * Fallback only — MalloyParserErrorListener's custom-error cases run first and
 * override these when they match.
 */
export class MalloyErrorStrategy extends DefaultErrorStrategy {
  protected reportInputMismatch(
    recognizer: Parser,
    e: InputMismatchException
  ): void {
    const offendingToken = e.getOffendingToken(recognizer);
    const expected = e.expectedTokens?.toArray() ?? [];
    const reserved = reservedNameMessage(offendingToken, expected, recognizer);
    if (reserved) {
      this.notifyErrorListeners(recognizer, reserved, e);
      return;
    }
    const offending = this.getTokenErrorDisplay(offendingToken);
    const clause = describeExpected(expected, recognizer.vocabulary);
    this.notifyErrorListeners(recognizer, unexpected(offending, clause), e);
  }

  protected reportUnwantedToken(recognizer: Parser): void {
    if (this.inErrorRecoveryMode(recognizer)) {
      return;
    }
    this.beginErrorCondition(recognizer);
    const t = recognizer.currentToken;
    const expected = this.getExpectedTokens(recognizer).toArray();
    const reserved = reservedNameMessage(t, expected, recognizer);
    if (reserved) {
      recognizer.notifyErrorListeners(reserved, t, undefined);
      return;
    }
    const offending = this.getTokenErrorDisplay(t);
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
    const expected = this.getExpectedTokens(recognizer).toArray();
    const reserved = reservedNameMessage(t, expected, recognizer);
    if (reserved) {
      recognizer.notifyErrorListeners(reserved, t, undefined);
      return;
    }
    const offending = this.getTokenErrorDisplay(t);
    const clause = describeExpected(expected, recognizer.vocabulary);
    const msg = clause
      ? `missing ${clause} before ${offending}`
      : `something is missing before ${offending}`;
    recognizer.notifyErrorListeners(msg, t, undefined);
  }

  // Dispatched from reportError (already in error condition), unlike the inline-
  // recovery methods above — an inErrorRecoveryMode guard here would swallow the
  // error. Short-circuit to the reserved-word hint, else defer to super.
  protected reportNoViableAlternative(
    recognizer: Parser,
    e: NoViableAltException
  ): void {
    const t = recognizer.currentToken;
    const expected = this.getExpectedTokens(recognizer).toArray();
    const reserved = reservedNameMessage(t, expected, recognizer);
    if (reserved) {
      this.notifyErrorListeners(recognizer, reserved, e);
      return;
    }
    super.reportNoViableAlternative(recognizer, e);
  }
}
