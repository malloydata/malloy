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
        pipeline: [{type: 'raw', fields: []}],
        location: this.location,
      },
      outputStruct: structDef,
      inputStruct: structDef,
    };
  }

  query(): Query {
    return this.queryComp(true).query;
  }
}
