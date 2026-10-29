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
  // See SQArrow: built once, so a second call neither recompiles nor
  // duplicates the errors of the first.
  asQuery?: QueryRefine;
  asSource?: QuerySource;

  constructor(
    readonly toRefine: SourceQueryElement,
    readonly refine: View
  ) {
    super({toRefine, refine});
  }

  getQuery() {
    if (this.asQuery) {
      return this.asQuery;
    }
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
      this.asQuery = new QueryRefine(refinedQuery, this.refine);
      this.has({query: this.asQuery});
      return this.asQuery;
    }
  }

  getSource() {
    if (this.asSource) {
      return this.asSource;
    }
    const query = this.getQuery();
    if (query) {
      this.asSource = new QuerySource(query);
      this.has({queryAsSource: this.asSource});
      return this.asSource;
    }
  }
}
