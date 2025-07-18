/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryField} from './query_node';

export function caseGroup(
  field: QueryField,
  groupSets: number[],
  s: string
): string {
  if (groupSets.length === 0) {
    return s;
  } else {
    const exp =
      groupSets.length === 1
        ? `=${groupSets[0]}`
        : ` IN (${groupSets.join(',')})`;
    return `CASE WHEN group_set${exp} THEN\n  ${s}\n  END`;
  }
}