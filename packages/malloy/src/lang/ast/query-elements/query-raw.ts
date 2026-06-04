/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Query} from '../../../model/malloy_types';
import {refIsStructDef} from '../../../model/malloy_types';
import type {Source} from '../source-elements/source';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';
import type {QueryElement} from '../types/query-element';

/**
 * A query element which represents running the intrinsic fields of a
 * source directly as a query. Currently this only works for SQL sources,
 * where the "raw query" just means running the SQL that defined the source
 * directly.
 *
 * e.g. after `run:` in `run: duckdb.sql("...")`
 */
export class QueryRaw extends MalloyElement implements QueryElement {
  elementType = 'query-raw';

  constructor(readonly source: Source) {
    super({source});
  }

  queryComp(isRefOk: boolean): QueryComp {
    const invoked = isRefOk
      ? this.source.structRef(undefined)
      : {structRef: this.source.getSourceDef(undefined)};
    const structDef = refIsStructDef(invoked.structRef)
      ? invoked.structRef
      : this.source.getSourceDef(undefined);
    return {
      query: {
        type: 'query',
        ...invoked,
        pipeline: [{type: 'raw', fields: [], outputStruct: structDef}],
        location: this.location,
      },
      outputStruct: structDef,
      inputStruct: structDef,
    };
  }

  query(isRefOk = true): Query {
    return this.queryComp(isRefOk).query;
  }
}
