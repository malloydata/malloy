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

import {
  PipeSegment,
  Query,
  StructDef,
  refIsStructDef,
} from '../../../model/malloy_types';
import {Source} from '../elements/source';
import {QuerySpace} from '../field-space/query-spaces';
import {StaticSpace} from '../field-space/static-space';
import {detectAndRemovePartialStages} from '../query-utils';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {PipelineComp} from '../types/pipeline-comp';
import {QueryComp} from '../types/query-comp';
import {QueryElement} from '../types/query-element';
import {View} from './view';

export class VArrow extends View {
  elementType = 'viewArrow';

  constructor(
    readonly base: View,
    readonly op: View
  ) {
    super({base, op});
  }

  pipelineComp(fs: FieldSpace): PipelineComp {
    const baseComp = this.base.pipelineComp(fs);
    const nextFS = new StaticSpace(baseComp.outputStruct);
    const finalComp = this.op.pipelineComp(nextFS);
    return {
      pipeline: [...baseComp.pipeline, ...finalComp.pipeline],
      outputStruct: finalComp.outputStruct,
    };
  }

  refine(
    _inputFS: FieldSpace,
    _pipeline: PipeSegment[],
    _isNestIn: QuerySpace | undefined
  ): PipeSegment[] {
    this.log('A multi-segment view cannot be used as a refinement');
    return [];
  }
}

export class QArrow extends MalloyElement {
  elementType = 'arrow';

  constructor(
    readonly source: Source | QueryElement,
    readonly view: View
  ) {
    super({source, view});
  }

  queryComp(isRefOk: boolean): QueryComp {
    let inputStruct: StructDef;
    let queryBase: Query;
    let fieldSpace: FieldSpace;
    if (this.source instanceof Source) {
      // We create a fresh query with either the QOPDesc as the head,
      // the view as the head, or the scalar as the head (if scalar lenses is enabled)
      const structRef = isRefOk
        ? this.source.structRef()
        : this.source.structDef();
      queryBase = {
        type: 'query',
        structRef,
        pipeline: [],
        location: this.location,
      };
      inputStruct = refIsStructDef(structRef)
        ? structRef
        : this.source.structDef();
      fieldSpace = new StaticSpace(inputStruct);
    } else {
      // We are adding a second stage to the given "source" query; we get the query and add a segment
      const lhsQuery = this.source.queryComp(isRefOk);
      queryBase = lhsQuery.query;
      inputStruct = lhsQuery.outputStruct;
      fieldSpace = new StaticSpace(lhsQuery.outputStruct);
    }
    const {pipeline, annotation, outputStruct} =
      this.view.pipelineComp(fieldSpace);
    return {
      query: {
        ...queryBase,
        annotation,
        pipeline: [...queryBase.pipeline, ...pipeline],
      },
      outputStruct,
      inputStruct,
    };
  }

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
