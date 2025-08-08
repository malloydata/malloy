/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export function caseGroup(groupSets: number[], s: string): string {
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

export class GenerateState {
  whereSQL?: string;
  applyValue?: string;
  totalGroupSet = -1;

  withWhere(s?: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = s;
    newState.applyValue = this.applyValue;
    newState.totalGroupSet = this.totalGroupSet;
    return newState;
  }

  withApply(s: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = s;
    newState.totalGroupSet = this.totalGroupSet;
    return newState;
  }

  withTotal(groupSet: number): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = this.applyValue;
    newState.totalGroupSet = groupSet;
    return newState;
  }
}
