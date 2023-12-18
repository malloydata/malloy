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

import {PipeSegment, QueryFieldDef, isRawSegment} from '../../../model';
import {MalloyElement} from '../types/malloy-element';

export function refine(
  logTo: MalloyElement,
  refineTo: PipeSegment[],
  refineFrom: PipeSegment
): PipeSegment[] {
  // TODO we should probably support this
  if (refineTo.length !== 1) {
    logTo.log('Named refinements of multi-stage views are not supported');
    // TODO better error pipeline?
    return refineTo;
  }
  const to = {...refineTo[0]};
  const from = refineFrom;
  if (isRawSegment(to)) {
    logTo.log('Cannot refine raw query, must add an explicit query stage');
  } else {
    // TODO need to disallow partial + index for now to make the types happy
    if (to.type === 'partial' && from.type !== 'index' && from.type !== 'raw') {
      to.type = from.type;
    } else if (from.type !== to.type) {
      logTo.log(`cannot refine ${to.type} view with ${from.type} view`);
    }

    if (from.type !== 'index' && to.type !== 'index' && from.type !== 'raw') {
      if (from.orderBy !== undefined || from.by !== undefined) {
        if (to.orderBy === undefined && to.by === undefined) {
          if (from.orderBy) {
            to.orderBy = from.orderBy;
          } else if (from.by) {
            to.by = from.by;
          }
        } else {
          logTo.log('refinement cannot override existing ordering');
        }
      }

      if (from.limit !== undefined) {
        if (to.limit === undefined) {
          to.limit = from.limit;
        } else {
          logTo.log('refinement cannot override existing limit');
        }
      }
    }

    to.filterList =
      to.filterList !== undefined || from.filterList !== undefined
        ? [...(to.filterList ?? []), ...(from.filterList ?? [])]
        : undefined;

    const overlappingFields: (QueryFieldDef | string)[] = [];
    const nonOverlappingFields: (QueryFieldDef | string)[] = [];
    const existingNames = new Map<string, QueryFieldDef | string>(
      to.fields.map(
        (f: QueryFieldDef | string): [string, QueryFieldDef | string] => [
          extractName(f),
          f,
        ]
      )
    );
    for (const field of from.fields) {
      if (existingNames.has(extractName(field))) {
        overlappingFields.push(field);
      } else {
        nonOverlappingFields.push(field);
      }
    }

    to.fields = [...to.fields, ...nonOverlappingFields];
    if (overlappingFields.length > 0) {
      logTo.log(
        `overlapping fields in refinement: ${overlappingFields.map(
          extractName
        )}`
      );
    }
  }

  return [to];
}

function extractName(f1: QueryFieldDef | string): string {
  return typeof f1 === 'string' ? f1 : f1.as ?? f1.name;
}
