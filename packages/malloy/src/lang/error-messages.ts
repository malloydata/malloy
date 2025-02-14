/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Token} from 'antlr4ts';

const validKeywords = [
  'accept',
  'aggregate',
  'calculate',
  'calculation',
  'declare',
  'dimension',
  'except',
  'extend',
  'group_by',
  'having',
  'index',
  'internal',
  'join_cross',
  'join_one',
  'join_many',
  'limit',
  'measure',
  'nest',
  'order_by',
  'partition_by',
  'primary_key',
  'private',
  'project',
  'public',
  'query',
  'rename',
  'run',
  'sample',
  'select',
  'source',
  'top',
  'where',
  'view',
  'timezone',
  'all',
  'and',
  'as',
  'asc',
  'avg',
  'boolean',
  'by',
  'case',
  'cast',
  'condition',
  'count',
  'compose',
  'date',
  'day',
  'desc',
  'distinct',
  'else',
  'end',
  'exclude',
  'extend',
  'false',
  'full',
  'for',
  'from',
  'has',
  'hour',
  'import',
  'include',
  'inner',
  'is',
  'in',
  'internal_kw',
  'json',
  'last',
  'left',
  'like',
  'max',
  'min',
  'minute',
  'month',
  'not',
  'now',
  'null',
  'number',
  'on',
  'or',
  'pick',
  'private',
  'public',
  'quarter',
  'right',
  'second',
  'string',
  'sum',
  'sql',
  'table',
  'then',
  'this',
  'timestamp',
  'to',
  'true',
  'turtle',
  'week',
  'when',
  'with',
  'year',
  'ungrouped',
];

function levenshteinDistance(a, b) {
  // Simple implementation of Levenshtein distance
  const m = a.length;
  const n = b.length;
  const d = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) {
    d[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}
function fuzzySymbolMatcher(token: string) {
  let closestMatch = '';
  let minDistance = Infinity;
  for (const symbol of validKeywords) {
    const distance = levenshteinDistance(token, symbol);
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = symbol;
    }
  }
  return closestMatch;
}

/**
 * Attempts to augment a bare ANTLR lexer/parser error message with additional
 * language specific information with the goal of providing more helpful
 * error messages to users of Malloy.
 */
export const updateErrorMessage = (
  recognizer: unknown,
  offendingSymbol: Token | undefined,
  line: number,
  charPositionInLine: number,
  message: string,
  _e: unknown
): string => {
  let nearestMatch = '';

  nearestMatch = offendingSymbol?.text
    ? fuzzySymbolMatcher(offendingSymbol.text)
    : '';
    
  if (nearestMatch) {
    message += `. Did you mean '${nearestMatch}'?`;
  }

  return message;
};
