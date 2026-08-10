/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryElement} from '../types/query-element';
import {MalloyElement} from '../types/malloy-element';
import type {Source} from '../source-elements/source';
import type {
  LogMessageOptions,
  MessageCode,
  MessageParameterType,
} from '../../parse-log';

/**
 * An AST element which can be treated as either a source or a query
 * depending on context. For instance, an `SQReference` represents
 * a model-level reference to an entity which is either a source or
 * a query.
 */
export abstract class SourceQueryElement extends MalloyElement {
  /** Set once this element has reported why it could not produce a value. */
  errored = false;

  getSource(): Source | undefined {
    return;
  }

  getQuery(): QueryElement | undefined {
    return;
  }

  isSource(): boolean {
    return false;
  }

  /**
   * Report the one message which explains why this expression could not be
   * turned into a source or a query.
   *
   * Every element in a source/query expression says something when it fails,
   * so an outer element's generic complaint ("could not get source for
   * query") would stack on top of the specific cause already reported
   * beneath it. The message is therefore logged only when nothing in this
   * subtree has spoken yet, and `errored` is set either way, which is what
   * silences the elements above.
   *
   * This is not protection against logging the same message twice —
   * `MalloyElement.log` already drops a repeat of one message at one
   * location. It is one message per failed expression.
   *
   * The case it does not serve is two unrelated complaints about the same
   * element: a second `sqLog` is dropped. Use `sqClaimError` for those.
   */
  sqLog<T extends MessageCode>(
    code: T,
    parameters: MessageParameterType<T>,
    options?: LogMessageOptions
  ): T {
    if (this.isErrorFree()) {
      this.logError(code, parameters, options);
    }
    this.errored = true;
    return code;
  }

  /**
   * Take the one error report this expression is allowed, for an element with
   * more than one complaint to make. False means something below has already
   * spoken. True means the caller owns the report and should `logError` each
   * of its complaints; nothing above will speak after that.
   */
  sqClaimError(): boolean {
    if (!this.isErrorFree()) {
      return false;
    }
    this.errored = true;
    return true;
  }

  /** True until this element, or anything below it, has reported a failure. */
  isErrorFree(): boolean {
    if (this.errored) {
      return false;
    }
    let clean = true;
    for (const child of this.walk()) {
      if (child instanceof SourceQueryElement && child.errored) {
        clean = false;
        break;
      }
    }
    return clean;
  }
}
