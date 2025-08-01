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

import type {PipeSegment} from '../../../model';
import {ErrorFactory} from '../error-factory';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {SourceFieldSpace} from '../types/field-space';
import type {PipelineComp} from '../types/pipeline-comp';
import {refine} from './refine-utils';
import {View} from './view';

/**
 * A view operation that represents the refinement of one view
 * with another view.
 *
 * e.g. `by_carrier + { limit: 10 }`
 */
export class ViewRefine extends View {
  elementType = 'refine';

  constructor(
    readonly base: View,
    readonly refinement: View
  ) {
    super({base, refinement});
  }

  pipelineComp(
    fs: SourceFieldSpace,
    isNestIn?: QueryOperationSpace
  ): PipelineComp {
    const query = this.base.pipelineComp(fs);
    const resultPipe = this.refinement.refine(fs, query.pipeline, isNestIn);
    return {
      pipeline: resultPipe,
      annotation: query.annotation,
      outputStruct:
        resultPipe.length > 0
          ? resultPipe[resultPipe.length - 1].outputStruct
          : ErrorFactory.structDef,
    };
  }

  refine(
    inputFS: SourceFieldSpace,
    pipeline: PipeSegment[],
    isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[] {
    const refineFrom = this.pipelineComp(inputFS, isNestIn);
    if (refineFrom.pipeline.length !== 1) {
      this.refinement.logError(
        'refinement-with-multistage-view',
        'refinement must have exactly one stage'
      );
      // TODO better error pipeline?
      return pipeline;
    }
    return refine(this, pipeline, refineFrom.pipeline[0]);
  }

  getImplicitName(): string | undefined {
    return this.base.getImplicitName();
  }
}
