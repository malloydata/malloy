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
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import type {PipelineComp} from '../types/pipeline-comp';

/**
 * A `View` represents a sequence of operations to be performed on a
 * source to generate a query. A `View` can generate a pipeline from
 * a given `FieldSpace`, or it can refine an exisitng pipeline.
 *
 * In Malloy code, a `View` represents any view or nest definition/reference,
 * or the part of a query after the first `->` or `+`.
 *
 * e.g. the part after the `is` in:
 *   `view: x is { group_by: carrier }`
 *   `view: x is by_carrier + { where: state = 'CA' }`
 * e.g. after the colon in `nest: by_carrier`
 * e.g. after the plus in `run: flights_by_carrier + { limit: 10 }`
 * e.g. after the arrow in `run: flights -> by_carrier`
 */
export abstract class View extends MalloyElement {
  abstract pipelineComp(
    fs: FieldSpace,
    isNestIn?: QueryOperationSpace
  ): PipelineComp;

  pipeline(fs: FieldSpace, isNestIn?: QueryOperationSpace): PipeSegment[] {
    return this.pipelineComp(fs, isNestIn).pipeline;
  }

  abstract refine(
    inputFS: FieldSpace,
    pipeline: PipeSegment[],
    isNestIn: QueryOperationSpace | undefined
  ): PipeSegment[];

  abstract getImplicitName(): string | undefined;
}
