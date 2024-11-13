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

import {isEmptyCubeUsage, resolveCubeSources} from '../../../model/cube_utils';
import {isQuerySegment, Query, SourceDef} from '../../../model/malloy_types';
import {detectAndRemovePartialStages} from '../query-utils';
import {MalloyElement} from '../types/malloy-element';
import {QueryComp} from '../types/query-comp';

export abstract class QueryBase extends MalloyElement {
  abstract queryComp(isRefOk: boolean): QueryComp;

  query(): Query {
    const {inputStruct, query} = this.queryComp(true);
    // TODO add an error if a raw/index query is done against a cube

    let cubeResolvedSourceDef: SourceDef | undefined = undefined;
    if (isQuerySegment(query.pipeline[0])) {
      const cubeUsage = query.pipeline[0].cubeUsage;
      if (cubeUsage !== undefined && !isEmptyCubeUsage(cubeUsage)) {
        const resolved = resolveCubeSources(inputStruct, cubeUsage);
        cubeResolvedSourceDef = resolved.sourceDef;
      }
    }

    return {
      ...query,
      cubeResolvedSourceDef,
      pipeline: detectAndRemovePartialStages(query.pipeline, this),
    };
  }
}
