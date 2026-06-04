/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
