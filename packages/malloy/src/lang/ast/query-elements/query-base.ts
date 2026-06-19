/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
import {ErrorFactory} from '../error-factory';
import {detectAndRemovePartialStages} from '../query-utils';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(isRefOk: boolean): QueryComp;

  protected expandRefUsage(
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

  query(isRefOk = true): Query {
    const {query} = this.queryComp(isRefOk);

    return {
      ...query,
      pipeline: detectAndRemovePartialStages(query.pipeline, this),
    };
  }
}
