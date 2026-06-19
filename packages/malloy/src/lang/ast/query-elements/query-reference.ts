/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ErrorFactory} from '../error-factory';
import type {ModelEntryReference} from '../types/malloy-element';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';
import {QueryHeadStruct} from './query-head-struct';
import type {Query} from '../../../model/malloy_types';
import {refIsStructDef} from '../../../model/malloy_types';
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
      const outputStruct =
        query.pipeline[query.pipeline.length - 1].outputStruct;
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

  query(isRefOk = true): Query {
    return this.queryComp(isRefOk).query;
  }
}
