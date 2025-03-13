/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
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
