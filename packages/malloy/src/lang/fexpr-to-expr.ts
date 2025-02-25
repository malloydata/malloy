/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {Expr, StringLiteralNode} from '../model/malloy_types';
import {FilterLog, StringClause, StringParser} from '@malloydata/malloy-filter';

export function stringFilterToExpr(filter: string, applyTo: Expr): Expr {
  const sp = new StringParser(filter);
  const parseResult = sp.parse();
  if (anyErrors(parseResult.logs) || parseResult.clauses.length === 0) {
    return {node: 'false'};
  }
  const exprs = parseResult.clauses.map(c => stringClauseToExpr(c, applyTo));
  return combineClausesExprs(exprs);
}

function stringLiteral(x: string): StringLiteralNode {
  return {node: 'stringLiteral', literal: x};
}

function likeEscape(v: string): string {
  return v.replace(/[\\_%]/g, c => `\\${c}`);
}

function anyErrors(fl: FilterLog[]) {
  return fl.find(f => f.severity === 'error') !== undefined;
}

function combineClausesExprs(exprs: Expr[]): Expr {
  const first = exprs[0];
  if (exprs.length === 1) {
    return first;
  }
  const rest = combineClausesExprs(exprs.slice(1));
  return {
    node: 'or',
    kids: {left: first, right: rest},
  };
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

function stringClauseToExpr(op: StringClause, expr: Expr): Expr {
  switch (op.operator) {
    case 'null':
      return {node: 'is-null', e: expr};
    case 'not_null':
      return {node: 'is-not-null', e: expr};
    case 'not_empty':
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
    case 'empty':
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
    case 'not_contains':
    case 'contains':
      return mkLike(
        op.values,
        op.operator === 'not_contains',
        expr,
        s => `%${likeEscape(s)}%`
      );
    case 'not_starts':
    case 'starts':
      return mkLike(
        op.values,
        op.operator === 'not_starts',
        expr,
        s => `${likeEscape(s)}%`
      );
    case 'not_ends':
    case 'ends':
      return mkLike(
        op.values,
        op.operator === 'not_ends',
        expr,
        s => `%${likeEscape(s)}`
      );
    case '~':
    case '!~':
      return mkLike(op.escaped_values, op.operator === '!~', expr, s => s);
  }
}
