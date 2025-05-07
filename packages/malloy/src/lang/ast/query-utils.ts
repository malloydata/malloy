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

import type {PipeSegment} from '../../model';
import {isPartialSegment} from '../../model';
import type {MalloyElement} from './types/malloy-element';

// We don't want to ever generate actual 'partial' stages, so convert this
// into a reduce so the compiler doesn't explode
export function detectAndRemovePartialStages(
  pipeline: PipeSegment[],
  logTo: MalloyElement
): PipeSegment[] {
  const cleaned: PipeSegment[] = [];
  let hasPartials = false;
  for (const segment of pipeline) {
    if (isPartialSegment(segment)) {
      cleaned.push({...segment, type: 'reduce'});
      hasPartials = true;
    } else {
      cleaned.push(segment);
    }
  }
  if (hasPartials) {
    logTo.logError('ambiguous-view-type', {});
  }
  return cleaned;
}

export function unsatisfiedRequiredGroupBys(
  segment: PipeSegment | undefined,
  requiredGroupBys: string[][]
): string[][] {
  if (segment === undefined) return [];
  if (segment.type === 'raw' || segment.type === 'index') return [];
  const result: string[][] = [];
  for (const requiredGroupBy of requiredGroupBys) {
    let found = false;
    for (const field of segment.queryFields) {
      if (
        field.type === 'fieldref' &&
        field.path.length === requiredGroupBy.length &&
        field.path.every((p, i) => p === requiredGroupBy[i])
      ) {
        found = true;
        break;
      }
    }
    if (!found) {
      result.push(requiredGroupBy);
    }
  }
  return result;
}

export function validateRequiredGroupBys(
  segment: PipeSegment,
  logTo: MalloyElement,
  requiredGroupBys: string[][]
) {
  const missing = unsatisfiedRequiredGroupBys(segment, requiredGroupBys);
  for (const requiredGroupBy of missing) {
    logTo.logError(
      'missing-required-group-by',
      `Group by of \`${requiredGroupBy.join('.')}\` is required but not present`
    );
  }
}
