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

import {SourceQueryElement} from './source-query-element';
import {QuerySource} from '../source-elements/query-source';
import {QueryRefine} from '../query-elements/query-refine';
import type {View} from '../view-elements/view';
import {SQReference} from './sq-reference';

/**
 * An element which represents adding refinements to a query.
 * Generates errors if the LHS can't be understood as a query.
 *
 * e.g. `flights_by_carrier + { limit: 10 }`
 */
export class SQRefine extends SourceQueryElement {
  elementType = 'sq-refine';

  constructor(
    readonly toRefine: SourceQueryElement,
    readonly refine: View
  ) {
    super({toRefine, refine});
  }

  getQuery() {
    if (this.toRefine.isSource()) {
      if (this.toRefine instanceof SQReference) {
        this.sqLog(
          'illegal-refinement-of-source',
          `Cannot add view refinements to '${this.toRefine.ref.refString}' because it is a source`
        );
      } else {
        this.sqLog(
          'illegal-refinement-of-source',
          'Cannot add view refinements to a source'
        );
      }
      return;
    }
    const refinedQuery = this.toRefine.getQuery();
    if (refinedQuery) {
      const resultQuery = new QueryRefine(refinedQuery, this.refine);
      this.has({query: resultQuery});
      return resultQuery;
    }
  }

  getSource() {
    const query = this.getQuery();
    if (query) {
      const queryAsSource = new QuerySource(query);
      this.has({queryAsSource});
      return queryAsSource;
    }
  }
}
