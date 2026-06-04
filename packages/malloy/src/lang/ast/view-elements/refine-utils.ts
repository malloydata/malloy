/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment, QueryFieldDef} from '../../../model';
import {isQuerySegment, isRawSegment} from '../../../model';
import {mergeRefSummaries} from '../../composite-source-utils';
import {nameFromDef} from '../../field-utils';
import type {MalloyElement} from '../types/malloy-element';

export function refine(
  logTo: MalloyElement,
  refineTo: PipeSegment[],
  refineFrom: PipeSegment
): PipeSegment[] {
  // TODO we should probably support this
  if (refineTo.length !== 1) {
    logTo.logError(
      'refinement-with-multistage-view',
      'Named refinements of multi-stage views are not supported'
    );
    // TODO better error pipeline?
    return refineTo;
  }
  const to = {...refineTo[0]};
  const from = refineFrom;
  if (isRawSegment(to)) {
    logTo.logError(
      'refinement-of-raw-query',
      'Cannot refine raw query, must add an explicit query stage'
    );
  } else {
    // TODO need to disallow partial + index for now to make the types happy
    if (to.type === 'partial' && from.type !== 'index' && from.type !== 'raw') {
      to.type = from.type;
    } else if (from.type !== to.type) {
      logTo.logError(
        'mismatched-view-types-for-refinement',
        `cannot refine ${to.type} view with ${from.type} view`
      );
    }

    if (from.type !== 'index' && to.type !== 'index' && from.type !== 'raw') {
      if (from.orderBy !== undefined && !from.defaultOrderBy) {
        if (to.orderBy === undefined || to.defaultOrderBy) {
          to.orderBy = from.orderBy;
        } else {
          logTo.logError(
            'ordering-overridden-in-refinement',
            'refinement cannot override existing ordering'
          );
        }
      }

      if (from.limit !== undefined) {
        if (to.limit === undefined) {
          to.limit = from.limit;
        } else {
          logTo.logError(
            'limit-overridden-in-refinement',
            'refinement cannot override existing limit'
          );
        }
      }
    }

    to.filterList =
      to.filterList !== undefined || from.filterList !== undefined
        ? [...(to.filterList ?? []), ...(from.filterList ?? [])]
        : undefined;

    if (isQuerySegment(from) && isQuerySegment(to)) {
      const overlappingFields: string[] = [];
      const missingOut: string[] = [];
      const existingNames = new Map<string, QueryFieldDef>(
        to.queryFields.map((f: QueryFieldDef): [string, QueryFieldDef] => [
          nameFromDef(f),
          f,
        ])
      );
      const outputFields = [...to.outputStruct.fields];
      const queryFields = [...to.queryFields];
      for (const field of from.queryFields) {
        const fieldName = nameFromDef(field);
        if (existingNames.has(fieldName)) {
          overlappingFields.push(fieldName);
        } else {
          queryFields.push(field);
          const outField = from.outputStruct.fields.find(
            f => f.name === fieldName
          );
          if (outField) {
            outputFields.push(outField);
          } else {
            missingOut.push(fieldName);
          }
        }
      }
      to.queryFields = queryFields;
      to.outputStruct.fields = outputFields;
      if (overlappingFields.length > 0) {
        logTo.logError(
          'name-conflict-in-refinement',
          `overlapping fields in refinement: ${overlappingFields.join(', ')}`
        );
      }
      if (missingOut.length > 0) {
        logTo.logError(
          'name-conflict-in-refinement',
          `missing output fields in refinement: ${missingOut.join(', ')}`
        );
      }
      to.refSummary = mergeRefSummaries(to.refSummary, from.refSummary);
    } else if (from.type === 'index' && to.type === 'index') {
      to.indexFields = [...from.indexFields, ...to.indexFields];
    }
  }

  return [to];
}
