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

import {StaticSourceSpace} from '../field-space/static-space';
import {getFinalStruct} from '../struct-utils';
import type {QueryComp} from '../types/query-comp';
import type {QueryElement} from '../types/query-element';
import type {View} from '../view-elements/view';
import {QueryBase} from './query-base';

/**
 * A query operation that consists of an exisitng query with refinements.
 *
 * e.g. after `run:` in `run: flights_by_carrier + { limit: 10 }`
 */
export class QueryRefine extends QueryBase implements QueryElement {
  elementType = 'query-refine';

  constructor(
    readonly base: QueryElement,
    readonly refinement: View
  ) {
    super({base, refinement});
  }

  queryComp(isRefOk: boolean): QueryComp {
    const q = this.base.queryComp(isRefOk);
    const inputFS = new StaticSourceSpace(q.inputStruct);
    const resultPipe = this.refinement.refine(
      inputFS,
      q.query.pipeline,
      undefined
    );
    const query = {
      ...q.query,
      pipeline: resultPipe,
    };

    const compositeResolvedSourceDef = this.resolveCompositeSource(
      q.inputStruct,
      query
    );

    return {
      query: {
        ...query,
        compositeResolvedSourceDef,
      },
      outputStruct: getFinalStruct(this.refinement, q.inputStruct, resultPipe),
      inputStruct: q.inputStruct,
    };
  }
}
