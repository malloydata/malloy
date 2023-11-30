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

import {Query} from '../../../model/malloy_types';
import {StaticSpace} from '../field-space/static-space';
import {ViewOrScalarFieldReference} from '../query-items/field-references';
import {QOPDesc} from '../query-properties/qop-desc';
import {Refinement} from '../query-properties/refinements';
import {detectAndRemovePartialStages} from '../query-utils';
import {getFinalStruct} from '../struct-utils';
import {MalloyElement} from '../types/malloy-element';
import {QueryComp} from '../types/query-comp';
import {QueryElement} from '../types/query-element';

export class Refine extends MalloyElement {
  elementType = 'refine';

  constructor(
    readonly queryToRefine: QueryElement,
    readonly refinement: QOPDesc | ViewOrScalarFieldReference
  ) {
    super(queryToRefine ? {queryToRefine, refinement} : {refinement});
  }

  queryComp(isRefOk: boolean): QueryComp {
    const refinement = Refinement.from(this.refinement);
    this.has({refinementCls: refinement});
    const query = this.queryToRefine.queryComp(isRefOk);
    const refineFS = new StaticSpace(query.refineInputStruct);
    // TODO deal with nest
    const resultPipe = refinement.refine(
      refineFS,
      query.query.pipeline,
      undefined
    );
    return {
      query: {
        ...query.query,
        pipeline: resultPipe,
      },
      outputStruct: getFinalStruct(
        this.refinement,
        query.refineInputStruct,
        resultPipe
      ),
      refineInputStruct: query.refineInputStruct,
    };
  }

  // TODO this code is duplicated in Arrow
  query(): Query {
    const q = this.queryComp(true).query;
    // TODO reconsider whether this is still necessary?
    const {hasPartials, pipeline} = detectAndRemovePartialStages(q.pipeline);
    if (hasPartials) {
      this.log(
        "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)"
      );
      return {...q, pipeline};
    }
    return q;
  }
}
