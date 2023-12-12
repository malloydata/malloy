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

import {Query, StructDef, refIsStructDef} from '../../../model/malloy_types';
import {Source} from '../source-elements/source';
import {StaticSpace} from '../field-space/static-space';
import {FieldSpace} from '../types/field-space';
import {QueryComp} from '../types/query-comp';
import {QueryElement} from '../types/query-element';
import {QueryBase} from './query-base';
import {View} from '../view-elements/view';

export class QueryArrow extends QueryBase {
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
    const {pipeline, annotation, outputStruct, name} =
      this.view.pipelineComp(fieldSpace);
    return {
      query: {
        ...queryBase,
        name,
        annotation,
        pipeline: [...queryBase.pipeline, ...pipeline],
      },
      outputStruct,
      inputStruct,
    };
  }
}
