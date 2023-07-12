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

import {Query, refIsStructDef} from '../../../model/malloy_types';

import {Source} from '../elements/source';
import {ErrorFactory} from '../error-factory';
import {StaticSpace} from '../field-space/static-space';
import {QueryComp} from '../types/query-comp';
import {TurtleHeadedPipe} from '../elements/pipeline-desc';

export class FullQuery extends TurtleHeadedPipe {
  constructor(readonly explore: Source) {
    super({explore: explore});
  }

  queryComp(isRefOk: boolean): QueryComp {
    const structRef = isRefOk
      ? this.explore.structRef()
      : this.explore.structDef();
    const destQuery: Query = {
      type: 'query',
      structRef,
      pipeline: [],
      location: this.location,
    };
    const structDef = refIsStructDef(structRef)
      ? structRef
      : this.explore.structDef();
    let pipeFs = new StaticSpace(structDef);

    // TODO update the compiler to allow for a SQL-headed query with 0 stages,
    // which just runs the SQL. This would also allow us in ExistingQuery
    // to error on `my_sql_query refine { ... }` by checking if it is a 0
    // stage query.
    if (
      structDef.structSource.type === 'sql' &&
      this.qops.length === 0 &&
      !this.turtleName
    ) {
      destQuery.pipeline.push({
        type: 'project',
        fields: ['*'],
      });
    }

    if (ErrorFactory.isErrorStructDef(structDef)) {
      return {
        outputStruct: structDef,
        query: {
          structRef: structRef,
          pipeline: [],
        },
      };
    }
    if (this.turtleName) {
      const lookFor = this.turtleName.getField(pipeFs);
      if (lookFor.error) this.log(lookFor.error);
      const name = this.turtleName.refString;
      const {pipeline, location, annotation} = this.expandTurtle(
        name,
        structDef
      );
      destQuery.location = location;
      const refined = this.refinePipelineHead(pipeFs, {pipeline}).pipeline;
      if (this.withRefinement) {
        // TODO there is an issue with losing the name of the turtle
        // which we need to fix, possibly adding a "name:" field to a segment
        // TODO there was mention of promoting filters to the query
        destQuery.pipeline = refined;
      } else {
        destQuery.pipeHead = {name};
      }
      if (annotation) {
        destQuery.annotation = annotation;
      }
      const pipeStruct = this.getOutputStruct(structDef, refined);
      pipeFs = new StaticSpace(pipeStruct);
    }
    const appended = this.appendOps(destQuery.pipeline, pipeFs);
    destQuery.pipeline = appended.opList;
    return {outputStruct: appended.structDef, query: destQuery};
  }

  query(): Query {
    return this.queryComp(true).query;
  }
}
