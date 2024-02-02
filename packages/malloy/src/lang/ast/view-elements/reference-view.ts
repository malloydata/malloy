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
  StructDef,
  isAtomicFieldType,
  isTurtleDef,
} from '../../../model/malloy_types';
import {ErrorFactory} from '../error-factory';
import {QueryOperationSpace} from '../field-space/query-spaces';
import {ViewOrScalarFieldReference} from '../query-items/field-references';
import {getFinalStruct} from '../struct-utils';
import {FieldSpace} from '../types/field-space';
import {PipelineComp} from '../types/pipeline-comp';
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
  pipelineComp(fs: FieldSpace, _isNestIn: QueryOperationSpace): PipelineComp {
    return this._pipelineComp(fs);
  }

  _pipelineComp(
    fs: FieldSpace,
    {forRefinement} = {forRefinement: false}
  ): PipelineComp & {error?: boolean} {
    const lookup = this.reference.getField(fs);
    const oops = function () {
      return {
        inputStruct: ErrorFactory.structDef,
        outputStruct: ErrorFactory.structDef,
        pipeline: [],
        error: true,
      };
    };
    if (!lookup.found) {
      this.log(`\`${this.reference.refString}\` is not defined`);
      return oops();
    }
    if (!(lookup.found instanceof SpaceField)) {
      throw new Error('Expected space field');
    }
    const fieldDef = lookup.found.fieldDef();
    if (fieldDef === undefined) {
      throw new Error('Expected field to have definition');
    }
    if (isAtomicFieldType(fieldDef.type)) {
      const newSegment: PipeSegment = {
        type: 'reduce',
        queryFields: [this.reference.refToField],
      };
      const {dialect, queryTimezone, structRelationship} = fs.structDef();
      const name = this.reference.nameString;
      const outputStruct: StructDef = {
        type: 'struct',
        dialect,
        queryTimezone,
        name,
        fields: [fieldDef],
        structRelationship,
        structSource: {type: 'query_result'},
      };
      return {
        pipeline: [newSegment],
        name,
        outputStruct,
      };
    } else if (isTurtleDef(fieldDef)) {
      if (this.reference.list.length > 1) {
        if (forRefinement) {
          this.log('Cannot use view from join as refinement');
        } else {
          this.log('Cannot use view from join');
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
      };
    } else {
      if (forRefinement) {
        this.reference.log(
          `named refinement \`${this.reference.refString}\` must be a view, found a ${fieldDef.type}`
        );
      } else {
        this.reference.log('This operation is not supported');
      }
      return oops();
    }
  }

  private getRefinementSegment(inputFS: FieldSpace) {
    const {pipeline, error} = this._pipelineComp(inputFS, {
      forRefinement: true,
    });
    if (error) return;
    if (pipeline.length !== 1) {
      this.reference.log(
        `named refinement \`${this.reference.refString}\` must have exactly one stage`
      );
      return;
    }
    return pipeline[0];
  }

  // `isNestIn` is not needed because `ReferenceView`s never create a field space
  // that would use it; this operation is already compiled, and `isNestIn` is only
  // used for checking `exclude` references.
  refine(
    inputFS: FieldSpace,
    pipeline: PipeSegment[],
    _isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[] {
    const refineFrom = this.getRefinementSegment(inputFS);
    if (refineFrom) {
      return refine(this, pipeline, refineFrom);
    }
    // TODO better error pipeline
    return pipeline;
  }
}
