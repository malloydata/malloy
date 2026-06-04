/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Source} from '../source-elements/source';
import {SourceQueryElement} from './source-query-element';
import {QuerySource} from '../source-elements/query-source';
import {QueryArrow} from '../query-elements/query-arrow';
import type {View} from '../view-elements/view';
import type {QueryElement} from '../types/query-element';

/**
 * An expression that adds a segment to a source or query.
 * This generates a `QueryArrow`, which either creates a new query
 * from scratch with the LHS as the source, or creates a new query
 * by adding a segment to the LHS (when it is already a query).
 * When this element is treated as a source, the resulting query is
 * wrapped in a `QuerySource` element.
 *
 * e.g. `flights -> by_carrier`
 */
export class SQArrow extends SourceQueryElement {
  elementType = 'sq-arrow';
  constructor(
    readonly applyTo: SourceQueryElement,
    readonly operation: View
  ) {
    super({applyTo, operation});
  }

  getQuery(): QueryElement | undefined {
    const lhs = this.applyTo.isSource()
      ? this.applyTo.getSource()
      : this.applyTo.getQuery();
    if (lhs === undefined) {
      this.sqLog(
        'failed-to-compute-arrow-source',
        'Could not get LHS of arrow operation'
      );
      return;
    }
    const arr = new QueryArrow(lhs, this.operation);
    this.has({query: arr});
    return arr;
  }

  getSource(): Source | undefined {
    const query = this.getQuery();
    if (!query) {
      this.sqLog(
        'failed-to-compute-source-from-query',
        "Couldn't comprehend query well enough to make a source"
      );
      return;
    }
    const asSource = new QuerySource(query);
    this.has({asSource});
    return asSource;
  }
}
