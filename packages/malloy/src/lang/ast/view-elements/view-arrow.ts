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

import type {PipeSegment} from '../../../model/malloy_types';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import {StaticSourceSpace} from '../field-space/static-space';
import type {FieldSpace} from '../types/field-space';
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
    const nextFS = new StaticSourceSpace(baseComp.outputStruct);
    const finalComp = this.operation.pipelineComp(nextFS);
    return {
      pipeline: [...baseComp.pipeline, ...finalComp.pipeline],
      outputStruct: finalComp.outputStruct,
    };
  }

  refine(
    _inputFS: FieldSpace,
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
