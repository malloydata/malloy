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

import {ErrorFactory} from '../error-factory';
import type {ModelEntryReference} from '../types/malloy-element';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';
import {QueryHeadStruct} from './query-head-struct';
import type {Query} from '../../../model/malloy_types';
import {refIsStructDef} from '../../../model/malloy_types';
import {getFinalStruct} from '../struct-utils';
import type {QueryElement} from '../types/query-element';

/**
 * A query operation that is just a reference to an existing query.
 *
 * e.g. after the colon in `run: flights_by_carrier`
 */
export class QueryReference extends MalloyElement implements QueryElement {
  elementType = 'query-reference';

  constructor(readonly name: ModelEntryReference) {
    super();
  }

  queryComp(isRefOk: boolean): QueryComp {
    const headEntry = this.modelEntry(this.name);
    const query = headEntry?.entry;
    const oops = function () {
      return {
        inputStruct: ErrorFactory.structDef,
        outputStruct: ErrorFactory.structDef,
        query: ErrorFactory.query,
      };
    };
    if (!query) {
      this.logError(
        'query-reference-not-found',
        `Reference to undefined query '${this.name.refString}'`
      );
      return oops();
    }
    if (query.type === 'query') {
      const queryHead = new QueryHeadStruct(
        query.structRef,
        query.sourceArguments
      );
      this.has({queryHead: queryHead});
      const inputStruct = queryHead.getSourceDef(undefined);
      const outputStruct = getFinalStruct(this, inputStruct, query.pipeline);
      const unRefedQuery = isRefOk
        ? query
        : refIsStructDef(query.structRef)
        ? query
        : {...query, structRef: inputStruct};
      return {
        query: unRefedQuery,
        outputStruct,
        inputStruct,
      };
    }
    this.logError(
      'non-query-used-as-query',
      `Illegal reference to '${this.name}', query expected`
    );
    return oops();
  }

  query(): Query {
    return this.queryComp(true).query;
  }
}
