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

import {PipelineDesc} from '../elements/pipeline-desc';
import {ErrorFactory} from '../error-factory';
import {StaticSpace} from '../field-space/static-space';
import {ModelEntryReference} from '../types/malloy-element';
import {QueryComp} from '../types/query-comp';
import {QueryHeadStruct} from './query-head-struct';

export class ExistingQuery extends PipelineDesc {
  _head?: ModelEntryReference;

  set head(head: ModelEntryReference | undefined) {
    this._head = head;
    this.has({head: head});
  }

  get head(): ModelEntryReference | undefined {
    return this._head;
  }

  queryComp(isRefOk: boolean): QueryComp {
    if (!this.head) {
      throw this.internalError("can't make query from nameless query");
    }
    const queryEntry = this.modelEntry(this.head);
    const seedQuery = queryEntry?.entry;
    const oops = function () {
      return {
        outputStruct: ErrorFactory.structDef,
        query: ErrorFactory.query,
      };
    };
    if (!seedQuery) {
      this.log(`Reference to undefined query '${this.head}'`);
      return oops();
    }
    if (seedQuery.type !== 'query') {
      this.log(`Illegal reference to '${this.head}', query expected`);
      return oops();
    }
    const queryHead = new QueryHeadStruct(seedQuery.structRef);
    this.has({queryHead: queryHead});
    const exploreStruct = queryHead.structDef();
    const exploreFS = new StaticSpace(exploreStruct);
    const sourcePipe = this.refinePipeline(exploreFS, seedQuery);
    const walkStruct = this.getOutputStruct(exploreStruct, sourcePipe.pipeline);
    const appended = this.appendOps(
      sourcePipe.pipeline,
      new StaticSpace(walkStruct)
    );
    const destPipe = {...sourcePipe, pipeline: appended.opList};
    const query: Query = {
      type: 'query',
      ...destPipe,
      structRef: isRefOk ? queryHead.structRef() : queryHead.structDef(),
      location: this.location,
    };
    if (seedQuery.annotation) {
      query.annotation = seedQuery.annotation;
    }
    return {outputStruct: appended.structDef, query};
  }

  query(): Query {
    return this.queryComp(true).query;
  }
}
