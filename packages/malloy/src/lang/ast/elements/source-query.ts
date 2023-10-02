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

import {QueryElement} from '../types/query-element';
import {MalloyElement} from '../types/malloy-element';
import {Source} from './source';

export abstract class SourceQueryNode extends MalloyElement {
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

  sqLog(message: string) {
    if (this.isErrorFree()) {
      this.log(message);
    }
    this.errored = true;
  }

  isErrorFree(): boolean {
    if (this.errored) {
      return false;
    }
    let clean = true;
    for (const child of this.walk()) {
      if (child instanceof SourceQueryNode && child.errored) {
        clean = false;
        break;
      }
    }
    return clean;
  }
}
