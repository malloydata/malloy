/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment} from '../../../model';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import {StaticSourceSpace} from '../field-space/static-space';
import type {FieldSpace, SourceFieldSpace} from '../types/field-space';
import type {PipelineComp} from '../types/pipeline-comp';
import {View} from './view';

/**
 * A view operation which represents adding a segment (or multiple
 * segments) to another view operation.
 *
 * e.g. after the `is` in `view: x is by_carrier -> { select: * }`
 */
export class ViewArrow extends View {
  elementType = 'viewArrow';

  constructor(
    readonly base: View,
    readonly operation: View
  ) {
    super({base, operation});
  }

  pipelineComp(fs: FieldSpace): PipelineComp {
    const baseComp = this.base.pipelineComp(fs);
    const nextFS = new StaticSourceSpace(baseComp.outputStruct, 'public');
    const finalComp = this.operation.pipelineComp(nextFS);
    return {
      pipeline: [...baseComp.pipeline, ...finalComp.pipeline],
      outputStruct: finalComp.outputStruct,
    };
  }

  refine(
    _inputFS: SourceFieldSpace,
    _pipeline: PipeSegment[],
    _isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[] {
    this.logError(
      'refinement-with-multistage-view',
      'A multi-segment view cannot be used as a refinement'
    );
    return [];
  }

  getImplicitName(): string | undefined {
    return this.operation.getImplicitName();
  }
}
