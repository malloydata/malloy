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
  expandFieldUsage,
} from '../../../model/composite_source_utils';
import type {QueryFieldDef} from '../../../model/malloy_types';
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

  protected expandFieldUsage(
    inputSource: SourceDef,
    pipeline: PipeSegment[]
  ): PipeSegment[] {
    const ret: PipeSegment[] = [];
    let stageInput = inputSource;

    for (const segment of pipeline) {
      // Expand field usage for this segment
      const {expandedFieldUsage, activeJoins, ungroupings} = expandFieldUsage(
        segment,
        stageInput
      );

      // Create the new segment with expanded field usage
      let newSegment: PipeSegment =
        segment.type === 'raw'
          ? segment
          : {
              ...segment,
              expandedFieldUsage,
              activeJoins,
              expandedUngroupings: ungroupings,
            };

      // If this is a query segment, check for turtle fields that need their
      // later stages expanded (first stage is already handled by extractNestLevels)
      if (isQuerySegment(newSegment)) {
        newSegment = {
          ...newSegment,
          queryFields: newSegment.queryFields.map(field =>
            expandTurtleField(field)
          ),
        };
      }

      ret.push(newSegment);

      // Get the output struct for the next stage
      if ('outputStruct' in segment && segment.outputStruct) {
        stageInput = segment.outputStruct;
      } else {
        // Fallback - this should be improved to compute the actual output
        stageInput = ErrorFactory.structDef;
      }
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
    const {query} = this.queryComp(true);

    return {
      ...query,
      pipeline: detectAndRemovePartialStages(query.pipeline, this),
    };
  }
}

/**
 * Do field usage expansion in pipline segments after the first. The
 * first segment's field usage is merged in the query's.
 */
function expandTurtleField(field: QueryFieldDef): QueryFieldDef {
  // Only process turtle fields with multi-stage pipelines
  if (
    field.type !== 'turtle' ||
    !field.pipeline ||
    field.pipeline.length <= 1
  ) {
    return field;
  }

  // Expand stages 2+ of the pipeline
  const expandedPipeline = field.pipeline.map((stage, index) => {
    // Stage 0 is already handled by extractNestLevels
    if (index === 0) return stage;

    // For stages 1+, expand field usage using previous stage's output
    const prevStage = field.pipeline[index - 1];
    if (!prevStage.outputStruct) {
      // mtoy todo should throw maybe?
      return stage;
    }

    const {expandedFieldUsage, activeJoins, ungroupings} = expandFieldUsage(
      stage,
      prevStage.outputStruct
    );

    let expandedStage: PipeSegment =
      stage.type === 'raw'
        ? stage
        : {
            ...stage,
            expandedFieldUsage,
            activeJoins,
            expandedUngroupings: ungroupings,
          };

    // Recursively handle any nested turtles in this stage
    if (isQuerySegment(expandedStage)) {
      expandedStage = {
        ...expandedStage,
        queryFields: expandedStage.queryFields.map(nestedField =>
          expandTurtleField(nestedField)
        ),
      };
    }

    return expandedStage;
  });

  return {
    ...field,
    pipeline: expandedPipeline,
  };
}
