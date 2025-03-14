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

import {RefinedSource} from '../source-elements/refined-source';
import {SourceQueryElement} from './source-query-element';
import type {SourceDesc} from '../types/source-desc';
import type {IncludeItem} from './include-item';

/**
 * An element which represents adding source extensions to a
 * query or source using the `extend` operator. This element
 * cannot be treated as a query.
 *
 * e.g. `flights extend { rename: carrier2 is carrier }`
 */
export class SQExtend extends SourceQueryElement {
  elementType = 'sq-extend';
  asSource?: RefinedSource;

  constructor(
    readonly sqSrc: SourceQueryElement,
    readonly extend: SourceDesc,
    readonly includeList: IncludeItem[] | undefined
  ) {
    super({sqSrc, extend});
  }

  getSource() {
    if (this.asSource) {
      return this.asSource;
    }
    const src = this.sqSrc.getSource();
    if (src) {
      this.asSource = new RefinedSource(src, this.extend, this.includeList);
      this.has({asSource: this.asSource});
      return this.asSource;
    }
    this.sqLog(
      'failed-to-compute-source-to-extend',
      'Could not compute source to extend'
    );
  }

  isSource() {
    return true;
  }
}
