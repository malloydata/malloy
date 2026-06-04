/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
