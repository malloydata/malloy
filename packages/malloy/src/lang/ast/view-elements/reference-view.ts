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
import {isAtomic, isTurtle, sourceBase} from '../../../model/malloy_types';
import {ErrorFactory} from '../error-factory';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {ViewOrScalarFieldReference} from '../query-items/field-references';
import {getFinalStruct} from '../struct-utils';
import {mergeRequiredGroupBys} from '../types/expr-value';
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
      const newSegment: PipeSegment = {
        type: 'reduce',
        queryFields: [this.reference.refToField],
        compositeFieldUsage: fieldDef.compositeFieldUsage,
      };
      const name = this.reference.nameString;
      const outputStruct: SourceDef = {
        ...sourceBase(fs.structDef()),
        type: 'query_result',
        name,
        fields: [fieldDef],
      };
      return {
        pipeline: [newSegment],
        name,
        outputStruct,
        requiredGroupBys: fieldDef.requiredGroupBys ?? [],
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
      return {
        pipeline: [...fieldDef.pipeline],
        name: fieldDef.name,
        annotation: fieldDef.annotation,
        outputStruct: getFinalStruct(
          this.reference,
          fs.structDef(),
          fieldDef.pipeline
        ),
        requiredGroupBys: fieldDef.requiredGroupBys ?? [],
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

  private getRefinement(inputFS: SourceFieldSpace): {
    segment: PipeSegment | undefined;
    requiredGroupBys: string[];
  } {
    const {pipeline, error, requiredGroupBys} = this._pipelineComp(inputFS, {
      forRefinement: true,
    });
    if (error) return {segment: undefined, requiredGroupBys: []};
    if (pipeline.length !== 1) {
      this.reference.logError(
        'refinement-with-multistage-view',
        `named refinement \`${this.reference.refString}\` must have exactly one stage`
      );
      return {segment: undefined, requiredGroupBys: []};
    }
    return {segment: pipeline[0], requiredGroupBys};
  }

  // `isNestIn` is not needed because `ReferenceView`s never create a field space
  // that would use it; this operation is already compiled, and `isNestIn` is only
  // used for checking `exclude` references.
  refine(
    inputFS: SourceFieldSpace,
    requiredGroupBys: string[],
    pipeline: PipeSegment[],
    _isNestIn: QueryOperationSpace | undefined
  ): {pipeline: PipeSegment[]; requiredGroupBys: string[]} {
    const {segment: refineFrom, requiredGroupBys: refinementRequiredGroupBys} =
      this.getRefinement(inputFS);
    const allRequiredGroupBys =
      mergeRequiredGroupBys(requiredGroupBys, refinementRequiredGroupBys) ?? [];
    if (refineFrom) {
      return {
        pipeline: refine(this, pipeline, refineFrom),
        requiredGroupBys: allRequiredGroupBys,
      };
    }
    // TODO better error pipeline
    return {
      pipeline,
      requiredGroupBys: allRequiredGroupBys,
    };
  }

  getImplicitName(): string | undefined {
    return this.reference.nameString;
  }
}
