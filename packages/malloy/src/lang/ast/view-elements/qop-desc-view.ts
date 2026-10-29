/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment} from '../../../model/malloy_types';
import {isRawSegment} from '../../../model/malloy_types';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import {StaticSourceSpace} from '../field-space/static-space';
import {QOpDesc} from '../query-properties/qop-desc';
import type {SourceFieldSpace} from '../types/field-space';
import type {PipelineComp} from '../types/pipeline-comp';
import {LegalRefinementStage} from '../types/query-property-interface';
import {View} from './view';

/**
 * A view operation consisting of literal view operations.
 *
 * e.g. `{ limit: 10 }`
 */
export class QOpDescView extends View {
  elementType = 'qopdesc-view';
  constructor(readonly operation: QOpDesc) {
    super({operation});
  }

  pipelineComp(
    fs: SourceFieldSpace,
    isNestIn?: QueryOperationSpace
  ): PipelineComp {
    const newOperation = this.operation.getOp(fs, isNestIn);
    return {
      pipeline: [newOperation.segment],
      outputStruct: newOperation.outputSpace.structDef(),
    };
  }

  private getOp(
    inputFS: SourceFieldSpace,
    isNestIn: QueryOperationSpace | undefined,
    qOpDesc: QOpDesc,
    refineThis: PipeSegment
  ): PipeSegment {
    if (isRawSegment(refineThis)) {
      this.logError('refinement-of-raw-query', 'A raw query cannot be refined');
      return refineThis;
    }
    qOpDesc.refineFrom(refineThis);
    return qOpDesc.getOp(inputFS, isNestIn).segment;
  }

  refine(
    inputFS: SourceFieldSpace,
    _pipeline: PipeSegment[],
    isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[] {
    const pipeline = [..._pipeline];
    if (pipeline.length === 0) {
      return pipeline;
    }
    if (pipeline.length === 1) {
      this.operation.refineFrom(pipeline[0]);
      return [this.getOp(inputFS, isNestIn, this.operation, pipeline[0])];
    }
    const headRefinements = new QOpDesc([]);
    const tailRefinements = new QOpDesc([]);
    for (const qop of this.operation.list) {
      switch (qop.queryRefinementStage) {
        case LegalRefinementStage.Head:
          headRefinements.push(qop);
          break;
        case LegalRefinementStage.Single:
          qop.logError(
            'illegal-multistage-refinement-operation',
            'Illegal in refinement of a query with more than one stage'
          );
          break;
        case LegalRefinementStage.Tail:
          tailRefinements.push(qop);
          break;
        default:
          qop.logError(
            'illegal-refinement-operation',
            'Illegal query refinement'
          );
      }
    }
    if (headRefinements.notEmpty()) {
      this.has({headRefinements});
      pipeline[0] = this.getOp(
        inputFS,
        undefined,
        headRefinements,
        pipeline[0]
      );
    }
    if (tailRefinements.notEmpty()) {
      const last = pipeline.length - 1;
      this.has({tailRefinements});
      // The changes above should not be allowed to change the input struct
      // for the final segment meaningfully, so we can continue to use the existing
      // second-to-last struct
      const finalIn =
        pipeline.length > 1
          ? new StaticSourceSpace(
              pipeline[pipeline.length - 2].outputStruct,
              'public'
            )
          : inputFS;
      pipeline[pipeline.length - 1] = this.getOp(
        finalIn,
        undefined,
        tailRefinements,
        pipeline[last]
      );
    }
    return pipeline;
  }

  getImplicitName(): string | undefined {
    return undefined;
  }
}
