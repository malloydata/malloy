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
  emptyFieldUsage,
  resolveCompositeSources,
  sortFieldUsageByReferenceLocation,
} from '../../../model/composite_source_utils';
import {
  isIndexSegment,
  isQuerySegment,
  type PipeSegment,
  type Query,
  type SourceDef,
} from '../../../model/malloy_types';
import {detectAndRemovePartialStages} from '../query-utils';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(isRefOk: boolean): QueryComp;

  protected resolveCompositeSource(
    inputSource: SourceDef,
    pipeline: PipeSegment[]
  ): SourceDef | undefined {
    const stage1 = pipeline[0];
    // TODO some features don't work with composite sources; e.g. sources in `extend:` don't
    // play nicely; here, we skip all the composite checking if there are no composites,
    // which hides the fact that this code doesn't handle sources in `extend:`.
    if (
      (isQuerySegment(stage1) || isIndexSegment(stage1)) &&
      hasCompositesAnywhere(inputSource)
    ) {
      const fieldUsage = stage1.fieldUsage ?? emptyFieldUsage();
      const resolved = resolveCompositeSources(inputSource, stage1, fieldUsage);
      if (resolved.error) {
        if (
          resolved.error.code === 'no_suitable_composite_source_input' &&
          resolved.error.data.fields.length > 0
        ) {
          const conflict = resolved.error.data.fields;
          const sorted = sortFieldUsageByReferenceLocation(conflict);
          const lastUsage = sorted[sorted.length - 1];
          this.logError(
            'invalid-composite-field-usage',
            {
              newUsage: [lastUsage],
              allUsage: sorted,
            },
            {
              at: lastUsage.at,
            }
          );
        } else {
          this.logError(
            'could-not-resolve-composite-source',
            'Could not resolve composite source'
          );
        }
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
