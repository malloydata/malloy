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

import type {PipeSegment, SourceDef} from '../../../model/malloy_types';
import {
  expressionIsScalar,
  isAtomic,
  isQuerySegment,
  isRawSegment,
  isTurtle,
  sourceBase,
} from '../../../model/malloy_types';
import {ErrorFactory} from '../error-factory';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {ViewOrScalarFieldReference} from '../query-items/field-references';
import {attachDrillPaths} from '../query-properties/drill';
import type {SourceFieldSpace} from '../types/field-space';
import type {PipelineComp} from '../types/pipeline-comp';
import {SpaceField} from '../types/space-field';
import {refine} from './refine-utils';
import {View} from './view';

/**
 * A view operation that is just a reference to another view or a
 * scalar field (the latter of which only works when the `scalar_lenses`)
 * experiment is enabled.
 *
 * e.g. `by_carrier` in `flights -> by_carrier`
 * e.g. `carrier.nickname` in `nest: carrier.nickname`
 */
export class ReferenceView extends View {
  elementType = 'reference-view';
  constructor(readonly reference: ViewOrScalarFieldReference) {
    super({reference});
  }

  // `isNestIn` is not needed because `ReferenceView`s never create a field space
  // that would use it; this operation is already compiled, and `isNestIn` is only
  // used for checking `exclude` references.
  pipelineComp(
    fs: SourceFieldSpace,
    _isNestIn: QueryOperationSpace
  ): PipelineComp {
    return this._pipelineComp(fs);
  }

  _pipelineComp(
    fs: SourceFieldSpace,
    {forRefinement} = {forRefinement: false}
  ): PipelineComp & {error?: boolean} {
    const lookup = this.reference.getField(fs);
    const oops = function () {
      return {
        inputStruct: ErrorFactory.structDef,
        outputStruct: ErrorFactory.structDef,
        pipeline: [],
        error: true,
        requiredGroupBys: [],
      };
    };
    if (!lookup.found) {
      this.reference.logError(lookup.error.code, lookup.error.message);
      return oops();
    }
    if (!(lookup.found instanceof SpaceField)) {
      throw new Error('Expected space field');
    }
    const fieldDef = lookup.found.fieldDef();
    if (fieldDef === undefined) {
      throw new Error('Expected field to have definition');
    }
    if (isAtomic(fieldDef)) {
      const name = this.reference.nameString;
      const outputStruct: SourceDef = {
        ...sourceBase(fs.structDef()),
        type: 'query_result',
        name,
        fields: [fieldDef],
      };
      const newSegment: PipeSegment = {
        type: 'reduce',
        queryFields: [this.reference.refToField],
        fieldUsage: fieldDef.fieldUsage,
        outputStruct,
        // An atomic lens results in a array segment if it is a scalar
        isRepeated: expressionIsScalar(fieldDef.expressionType),
      };
      return {
        pipeline: [newSegment],
        name,
        outputStruct,
      };
    } else if (isTurtle(fieldDef)) {
      if (this.reference.list.length > 1) {
        if (forRefinement) {
          this.logError(
            'refinement-with-joined-view',
            'Cannot use view from join as refinement'
          );
        } else {
          this.logError('nest-of-joined-view', 'Cannot use view from join');
        }
        return oops();
      }
      let pipeline = [...fieldDef.pipeline];
      if (pipeline.length > 0 && isQuerySegment(pipeline[0])) {
        const head = pipeline[0];
        pipeline = [
          {
            ...head,
            referencedAt: this.reference.location,
          },
          ...pipeline.slice(1),
        ];
      }
      pipeline = attachDrillPaths(pipeline, fieldDef.name);
      return {
        pipeline,
        name: fieldDef.name,
        annotation: fieldDef.annotation,
        outputStruct: pipeline[pipeline.length - 1].outputStruct,
      };
    } else {
      if (forRefinement) {
        this.reference.logError(
          'refinement-with-source',
          `named refinement \`${this.reference.refString}\` must be a view, found a ${fieldDef.type}`
        );
      } else {
        this.reference.logError(
          'nest-of-source',
          'This operation is not supported'
        );
      }
      return oops();
    }
  }

  private getRefinement(inputFS: SourceFieldSpace): PipeSegment | undefined {
    const {pipeline, error} = this._pipelineComp(inputFS, {
      forRefinement: true,
    });
    if (error) return undefined;
    if (pipeline.length !== 1) {
      this.reference.logError(
        'refinement-with-multistage-view',
        `named refinement \`${this.reference.refString}\` must have exactly one stage`
      );
      return undefined;
    }
    const segment = pipeline[0];
    if (isRawSegment(segment)) return segment;
    return {
      ...segment,
      fieldUsage: segment.fieldUsage?.map(u => ({
        ...u,
        at: this.reference.location,
      })),
    };
  }

  // `isNestIn` is not needed because `ReferenceView`s never create a field space
  // that would use it; this operation is already compiled, and `isNestIn` is only
  // used for checking `exclude` references.
  refine(
    inputFS: SourceFieldSpace,
    pipeline: PipeSegment[],
    _isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[] {
    const refineFrom = this.getRefinement(inputFS);
    if (refineFrom) {
      return refine(this, pipeline, refineFrom);
    }
    // TODO better error pipeline
    return pipeline;
  }

  getImplicitName(): string | undefined {
    return this.reference.nameString;
  }
}
