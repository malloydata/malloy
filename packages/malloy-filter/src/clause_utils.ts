/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  ChainOp,
  NumberRange,
  StringFilter,
  NumberFilter,
  TemporalUnit,
  TemporalLiteral,
  TemporalFilter,
  FilterExpression,
} from './filter_interface';
import {
  isNumberFilter,
  isStringFilter,
  isStringCondition,
  isTemporalFilter,
} from './filter_interface';

/**
 * If there is a minus token, add "not:true" to the clause
 */
export function maybeNot(data: (Object | undefined)[]) {
  const [isMinus, op] = data;
  if (isMinus && op && isStringFilter(op)) {
    return {...op, not: true};
  }
  return op;
}

export function unescape(str: string) {
  return str.replace(/\\(.)/g, '$1');
}

/**
 * Escape all of these:  ,; |()\%_-
 */
export function escape(str: string) {
  const lstr = str.toLowerCase();
  if (lstr === 'null' || lstr === 'empty') {
    return '\\' + str;
  }
  return str.replace(/([,; |()\\%_-])/g, '\\$1');
}

/**
 * I tried to write the regex for these and I just kept finding strings where the regex failed.
 * Look at a string and find if it uses any unescaped like characters, if it starts or ends with
 * a percent match, and counts non escaped trailing spaces
 */
function describeString(s: string) {
  let percentStart = false;
  let percentEnd = false;
  let endSpaceCnt = 0;
  let hasLike = false;
  const iLen = s.length;
  for (let i = 0; i < iLen; i += 1) {
    const c = s[i];
    if (c === ' ' || c === '\t') {
      endSpaceCnt += 1;
      continue;
    }
    endSpaceCnt = 0;

    if (c === '%') {
      hasLike = true;
      if (i === 0) {
        percentStart = true;
      }
      percentEnd = true;
    } else {
      percentEnd = false;
      if (c === '\\') {
        i += 1;
      } else if (c === '_') {
        hasLike = true;
      }
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
    endSpace: endSpaceCnt,
  };
}

/**
 * Generate the correct match clause operator based on the contents
 * of the match string.
 */
export function matchOp(matchSrc: string): StringFilter {
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
        // the tail has no like characters, in the case of "starts with percent"
        // this equals [\ %] which we need to unescape
        // we want to write LIKE '^%%' ESCAPE
        // if we unescape the % here we need to re-escape it when we write the like statement
        // in this case the escaping needs to happen when the like string is computed
        return {operator: 'starts', values: [unescape(tail)]};
      }
    } else if (percentStart) {
      const head = matchTxt.slice(1);
      if (!describeString(head).hasLike) {
        // the head has no like characters, in the case of "ends with backslash"
        // head is [\, \]
        // we want to write, on MySQL LIKE '%\' or LIKE '%\\' on bigquery
        // which means we want the single backslash here ...
        // in this case the escaping needs to happen whenthe like string is turned into a string literal
        return {operator: 'ends', values: [unescape(head)]};
      }
    }
    return {operator: '~', escaped_values: [matchTxt]};
  }
  if (matchTxt.toLowerCase() === 'null' || matchTxt === 'NULL') {
    return {operator: 'null'};
  }
  if (matchTxt === 'empty' || matchTxt === 'EMPTY') {
    return {operator: 'empty'};
  }
  return {operator: '=', values: [unescape(matchTxt)]};
}

function sameAs<T extends FilterExpression>(a: T, b: FilterExpression): b is T {
  return (
    a.operator === b.operator && (a['not'] ?? false) === (b['not'] ?? false)
  );
}

export function conjoin(
  left: Object,
  op: string,
  right: Object
): StringFilter | null {
  if (isStringFilter(left) && isStringFilter(right)) {
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
): NumberFilter | null {
  if (isNumberFilter(left) && isNumberFilter(right)) {
    if (op === 'or' && left.operator === '=' && sameAs(left, right)) {
      const ret: NumberFilter = {
        operator: '=',
        values: [...left.values, ...right.values],
      };
      if (left.not) {
        ret.not = true;
      }
      return ret;
    }
    if (op === 'and' || op === 'or') {
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

export function mkValues(n: string, nList: string[]) {
  return {values: [n, ...nList]};
}

export function numNot(op: Object, notToken: unknown) {
  if (isNumberFilter(op) && notToken) {
    if (op.operator === '=') return {operator: '!=', values: op.values};
    if (op.operator === '!=') return {operator: '=', values: op.values};
    return {...op, not: true};
  }
  return op;
}

export function temporalNot(op: Object, notToken: unknown) {
  if (isTemporalFilter(op) && notToken) {
    return {...op, not: true};
  }
  return op;
}

export function joinTemporal(
  left: Object,
  op: string,
  right: Object
): TemporalFilter | null {
  if (isTemporalFilter(left) && isTemporalFilter(right)) {
    // if (
    //   (op === ',' || op === 'or') &&
    //   left.operator === '=' &&
    //   sameAs(left, right)
    // ) {
    //   const ret: NumberClause = {
    //     operator: '=',
    //     values: [...left.values, ...right.values],
    //   };
    //   if (left.not) {
    //     ret.not = true;
    //   }
    //   return ret;
    // }
    if (op === 'and' || op === 'or') {
      if (left.operator === op) {
        return {...left, members: [...left.members, right]};
      }
      return {operator: op, members: [left, right]};
    }
  }
  return null;
}

export function timeLiteral(
  literal: string,
  units?: TemporalUnit
): TemporalLiteral {
  const ret: TemporalLiteral = {moment: 'literal', literal};
  if (units) {
    ret.units = units;
  }
  return ret;
}

export function mkUnits(unit_s: string): TemporalUnit | undefined {
  switch (unit_s.toLowerCase()) {
    case 'second':
    case 'seconds':
      return 'second';
    case 'minute':
    case 'minutes':
      return 'minute';
    case 'hour':
    case 'hours':
      return 'hour';
    case 'day':
    case 'days':
      return 'day';
    case 'week':
    case 'weeks':
      return 'week';
    case 'month':
    case 'months':
      return 'month';
    case 'quarter':
    case 'quarters':
      return 'quarter';
    case 'year':
    case 'years':
      return 'year';
  }
  return undefined;
}
