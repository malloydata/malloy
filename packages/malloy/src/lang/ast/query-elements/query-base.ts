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
  emptyCompositeFieldUsage,
  isEmptyCompositeFieldUsage,
  resolveCompositeSources,
} from '../../../model/composite_source_utils';
import type {Query, SourceDef} from '../../../model/malloy_types';
import {isIndexSegment, isQuerySegment} from '../../../model/malloy_types';
import {detectAndRemovePartialStages} from '../query-utils';
import {MalloyElement} from '../types/malloy-element';
import type {QueryComp} from '../types/query-comp';

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(isRefOk: boolean): QueryComp;

  protected resolveCompositeSource(
    inputSource: SourceDef,
    query: Query
  ): SourceDef | undefined {
    const stage1 = query.pipeline[0];
    // TODO add an error if a raw query is done against a composite source
    if (stage1 && (isQuerySegment(stage1) || isIndexSegment(stage1))) {
      const compositeFieldUsage =
        stage1.compositeFieldUsage ?? emptyCompositeFieldUsage();
      if (
        !isEmptyCompositeFieldUsage(compositeFieldUsage) ||
        inputSource.type === 'composite'
      ) {
        const resolved = resolveCompositeSources(
          inputSource,
          compositeFieldUsage
        );
        return resolved.sourceDef;
      }
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
