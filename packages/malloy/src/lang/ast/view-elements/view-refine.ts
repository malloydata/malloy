/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
      annotations: query.annotations,
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
