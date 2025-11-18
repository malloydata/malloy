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
  hasCompositesAnywhere,
  resolveCompositeSources,
  logCompositeError,
  getExpandedSegment,
} from '../../composite-source-utils';
import {
  isIndexSegment,
  isQuerySegment,
  type PipeSegment,
  type Query,
  type SourceDef,
} from '../../../model/malloy_types';
import type {ParameterSpace} from '../field-space/parameter-space';
import {ErrorFactory} from '../error-factory';
import {detectAndRemovePartialStages} from '../query-utils';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(
    isRefOk: boolean,
    parameterSpace: ParameterSpace | undefined
  ): QueryComp;

  protected expandFieldUsage(
    inputSource: SourceDef,
    pipeline: PipeSegment[]
  ): PipeSegment[] {
    const ret: PipeSegment[] = [];
    let stageInput = inputSource;

    for (const segment of pipeline) {
      const newSegment = getExpandedSegment(segment, stageInput);
      ret.push(newSegment);
      // Get the output struct for the next stage
      stageInput = newSegment.outputStruct || ErrorFactory.structDef;
    }

    return ret;
  }

  protected resolveCompositeSource(
    inputSource: SourceDef,
    pipeline: PipeSegment[]
  ): SourceDef | undefined {
    const stage1 = pipeline[0];
    if (stage1 === undefined) return undefined;
    // TODO some features don't work with composite sources; e.g. sources in `extend:` don't
    // play nicely; here, we skip all the composite checking if there are no composites,
    // which hides the fact that this code doesn't handle sources in `extend:`.
    if (
      (isQuerySegment(stage1) || isIndexSegment(stage1)) &&
      hasCompositesAnywhere(inputSource)
    ) {
      const resolved = resolveCompositeSources(inputSource, stage1);
      if (resolved.error) {
        logCompositeError(resolved.error, this);
      }
      return resolved.sourceDef;
    }
    return undefined;
  }

  query(): Query {
    const {query} = this.queryComp(true, undefined);

    return {
      ...query,
      pipeline: detectAndRemovePartialStages(query.pipeline, this),
    };
  }
}
