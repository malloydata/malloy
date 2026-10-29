/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Source} from '../source-elements/source';
import {SourceQueryElement} from './source-query-element';
import {QueryRaw} from '../query-elements/query-raw';
import {SQLSource} from '../source-elements/sql-source';

/**
 * An element which wraps a known source (e.g. SQL or table).
 * Can be treated in specific circumstances as a query,
 * e.g. `run: duckdb.sql('...')`, but generally is just used as
 * a source.
 */
export class SQSource extends SourceQueryElement {
  elementType = 'sq-source';
  // See SQArrow: built once, so a second call neither recompiles nor
  // duplicates the errors of the first.
  asQuery?: QueryRaw;

  constructor(readonly theSource: Source) {
    super({theSource});
  }

  isSource() {
    return true;
  }

  getSource() {
    return this.theSource;
  }

  getQuery() {
    if (this.asQuery) {
      return this.asQuery;
    }
    if (this.theSource instanceof SQLSource) {
      this.asQuery = new QueryRaw(this.theSource);
      this.has({rawQuery: this.asQuery});
      return this.asQuery;
    } else {
      this.sqLog(
        'invalid-source-as-query',
        'This source cannot be used as a query'
      );
    }
  }
}
