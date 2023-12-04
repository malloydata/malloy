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

import {PipeSegment, isPartialSegment} from '../../model';

// We don't want to ever generate actual 'partial' stages, so convert this
// into a reduce so the compiler doesn't explode
export function detectAndRemovePartialStages(pipeline: PipeSegment[]): {
  hasPartials: boolean;
  pipeline: PipeSegment[];
} {
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
  return {hasPartials, pipeline: cleaned};
}
