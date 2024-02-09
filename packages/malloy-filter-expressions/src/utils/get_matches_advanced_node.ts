/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {FilterASTNode} from '../types';

export const getMatchesAdvancedNode = (
  expression: string,
  ast?: FilterASTNode
): FilterASTNode => {
  if (ast) {
    return {
      id: ast['id'],
      is: true,
      type: 'matchesAdvanced',
      expression:
        ast['expression'] === undefined ? expression : ast['expression'],
    };
  }
  return {
    id: 1,
    type: 'matchesAdvanced',
    expression,
  };
};
