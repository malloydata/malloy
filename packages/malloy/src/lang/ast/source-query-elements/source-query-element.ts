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
