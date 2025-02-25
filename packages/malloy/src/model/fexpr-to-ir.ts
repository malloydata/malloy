/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Expr, StringLiteralNode} from '../model/malloy_types';
import {StringClause} from '@malloydata/malloy-filter';

function stringLiteral(x: string): StringLiteralNode {
  return {node: 'stringLiteral', literal: x};
}

function likeEscape(v: string): string {
  return v.replace(/[\\_%]/g, c => `\\${c}`);
}

function mkLike(
  values: string[],
  isNeg: boolean,
  compareTo: Expr,
  likeify: (s: string) => string
): Expr {
  let retExpr: Expr = {node: 'false'};
  const combine = isNeg ? 'and' : 'or';
  for (const v of values) {
    const likeThis: Expr = {
      node: isNeg ? '!like' : 'like',
      kids: {left: compareTo, right: stringLiteral(likeify(v))},
    };
    if (retExpr.node === 'false') {
      retExpr = likeThis;
    } else {
      retExpr = {
        node: combine,
        kids: {
          left: retExpr,
          right: likeThis,
        },
      };
    }
  }
  return retExpr;
}

export function stringClauseToExpr(op: StringClause, expr: Expr): Expr {
  switch (op.operator) {
    case 'NULL':
      return {node: 'is-null', e: expr};
    case 'NOTNULL':
      return {node: 'is-not-null', e: expr};
    case 'NOTEMPTY':
      return {
        node: 'and',
        kids: {
          left: {
            node: '!=',
            kids: {
              left: expr,
              right: stringLiteral(''),
            },
          },
          right: {node: 'is-not-null', e: expr},
        },
      };
    case 'EMPTY':
      return {
        node: 'or',
        kids: {
          left: {
            node: '=',
            kids: {
              left: expr,
              right: stringLiteral(''),
            },
          },
          right: {node: 'is-null', e: expr},
        },
      };
    case '=':
    case '!=':
      if (op.values.length > 1) {
        return {
          node: 'in',
          not: op.operator === '!=',
          kids: {
            e: expr,
            oneOf: op.values.map(s => stringLiteral(s)),
          },
        };
      }
      return {
        node: op.operator,
        kids: {
          left: expr,
          right: stringLiteral(op.values[0]),
        },
      };
    case 'notContains':
    case 'contains':
      return mkLike(
        op.values,
        op.operator === 'notContains',
        expr,
        s => `%${likeEscape(s)}%`
      );
    case 'notStarts':
    case 'starts':
      return mkLike(
        op.values,
        op.operator === 'notStarts',
        expr,
        s => `${likeEscape(s)}%`
      );
    case 'notEnds':
    case 'ends':
      return mkLike(
        op.values,
        op.operator === 'notEnds',
        expr,
        s => `%${likeEscape(s)}`
      );
    case '~':
    case '!~':
      return mkLike(op.values, op.operator === '!~', expr, s => s);
  }
}
