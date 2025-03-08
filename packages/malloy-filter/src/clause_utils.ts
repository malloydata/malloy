/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  ChainOp,
  isNumberClause,
  isStringClause,
  isStringCondition,
  NumberRange,
  StringClause,
  NumberClause,
  ClauseBase,
} from './clause_types';

/**
 * If there is a minus token, add "not:true" to the clause
 */
export function maybeNot(data: (Object | undefined)[]) {
  const [isMinus, op] = data;
  if (isMinus && op && isStringClause(op)) {
    return {...op, not: true};
  }
  return op;
}

export function unescape(str: string) {
  return str.replace(/\\(.)/g, '$1');
}

/**
 * Escape all of these:  ,;| ()\%_
 */
export function escape(str: string) {
  if (str === 'null' || str === 'empty') {
    return '\\' + str;
  }
  return str.replace(/([,; |()\\%_-])/g, '\\$1');
}

/**
 * I tried to write the regex for these and I just kept finding strings where the regex failed.
 * Look at a string and find if it uses any unescaped like characters, if it starts or ends with
 * a percent match, and counts trailing spaces
 */
function describeString(s: string) {
  let state = 0;
  let percentStart = false;
  let percentEnd = false;
  let endSpace = 0;
  let hasLike = false;
  const iLen = s.length;
  for (const c of s) {
    if (state === 0) {
      // Beginning of line
      state = 1;
      if (c === '%') {
        hasLike = true;
        percentStart = true;
        continue;
      }
    }

    if (state === 1) {
      // Looking for backslash
      if (c === '\\') {
        endSpace = 0;
        percentEnd = false;
        state = 2;
        continue;
      }
      if (c === ' ' || c === '\t') {
        percentEnd = false;
        endSpace += 1;
      } else {
        endSpace = 0;
        if (c === '%') {
          hasLike = true;
          percentEnd = true;
        } else if (c === '_') {
          hasLike = true;
          percentEnd = false;
        }
      }
      continue;
    }

    if (state === 2) {
      state = 1;
    }
  }
  /*
   * For the purposes of "startsWith" and "endsWith"
   * the string "%" neither starts nor ends a match string
   */
  return {
    hasLike,
    percentEnd: percentEnd && iLen > 1,
    percentStart: percentStart && iLen > 1,
    endSpace,
  };
}

/**
 * Generate the correct match clause operator based on the contents
 * of the match string.
 */
export function matchOp(matchSrc: string): StringClause {
  let matchTxt = matchSrc.trimStart();
  const {hasLike, percentEnd, percentStart, endSpace} =
    describeString(matchTxt);
  if (endSpace > 0) {
    matchTxt = matchTxt.slice(0, -endSpace);
  }
  if (hasLike) {
    if (percentStart && percentEnd) {
      const mid = matchTxt.slice(1, -1);
      if (!describeString(mid).hasLike && mid.length > 0) {
        return {operator: 'contains', values: [unescape(mid)]};
      }
    } else if (percentEnd) {
      const tail = matchTxt.slice(0, -1);
      if (!describeString(tail).hasLike) {
        return {operator: 'starts', values: [unescape(tail)]};
      }
    } else if (percentStart) {
      const head = matchTxt.slice(1);
      if (!describeString(head).hasLike) {
        return {operator: 'ends', values: [unescape(head)]};
      }
    }
    return {operator: '~', escaped_values: [matchTxt]};
  }
  if (matchTxt === 'null' || matchTxt === 'NULL') {
    return {operator: 'null'};
  }
  if (matchTxt === 'empty' || matchTxt === 'EMPTY') {
    return {operator: 'empty'};
  }
  // Unescape everything else
  return {operator: '=', values: [unescape(matchTxt)]};
}

function sameAs<T extends ClauseBase>(a: T, b: ClauseBase): b is T {
  return (
    a.operator === b.operator && (a['not'] ?? false) === (b['not'] ?? false)
  );
}

export function conjoin(
  left: Object,
  op: string,
  right: Object
): StringClause | null {
  if (isStringClause(left) && isStringClause(right)) {
    if (op === ',') {
      if (left.operator === '~' && sameAs(left, right)) {
        return {
          ...left,
          escaped_values: [...left.escaped_values, ...right.escaped_values],
        };
      }
      if (isStringCondition(left) && sameAs(left, right)) {
        return {...left, values: [...left.values, ...right.values]};
      }
    }
    const operator: ChainOp | undefined =
      op === ',' ? ',' : op === '|' ? 'or' : op === ';' ? 'and' : undefined;
    if (operator) {
      if (left.operator === operator) {
        return {...left, members: [...left.members, right]};
      }
      return {operator, members: [left, right]};
    }
  }
  return null;
}

export function joinNumbers(
  left: Object,
  op: string,
  right: Object
): NumberClause | null {
  if (isNumberClause(left) && isNumberClause(right)) {
    if (
      (op === ',' || op === 'or') &&
      left.operator === '=' &&
      sameAs(left, right)
    ) {
      const ret: NumberClause = {
        operator: '=',
        values: [...left.values, ...right.values],
      };
      if (left.not) {
        ret.not = true;
      }
      return ret;
    }
    if (op === ',' || op === 'and' || op === 'or') {
      if (left.operator === op) {
        return {...left, members: [...left.members, right]};
      }
      return {operator: op, members: [left, right]};
    }
  }
  return null;
}

export function mkRange(
  left: string,
  rFrom: string,
  rTo: string,
  right: string
): NumberRange | null {
  return {
    operator: 'range',
    startValue: rFrom,
    startOperator: left === '(' ? '>' : '>=',
    endValue: rTo,
    endOperator: right === ')' ? '<' : '<=',
  };
}

export function numNot(op: Object, notToken: unknown) {
  if (isNumberClause(op) && notToken) {
    return {...op, not: true};
  }
  return op;
}
