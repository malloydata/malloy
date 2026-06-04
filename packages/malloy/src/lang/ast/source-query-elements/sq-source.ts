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
    if (this.theSource instanceof SQLSource) {
      const rawQuery = new QueryRaw(this.theSource);
      this.has({rawQuery});
      return rawQuery;
    } else {
      this.sqLog(
        'invalid-source-as-query',
        'This source cannot be used as a query'
      );
    }
  }
}
