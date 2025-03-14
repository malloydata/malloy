/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Expr} from '../../model/malloy_types';
import {exprHasE, exprHasKids, exprIsLeaf} from '../../model/malloy_types';

import type {
  BooleanClause,
  NumberClause,
  StringClause,
  TemporalClause,
} from '@malloydata/malloy-filter';
import {
  BooleanFilterExpression,
  NumberFilterExpression,
  StringFilterExpression,
  TemporalFilterExpression,
} from '@malloydata/malloy-filter';

/**
 * Returns a readable shorthand for the an Expr for use in debugging.
 * If not passed any symbols, the first field reference will be A,
 * the second B and so on in the output.
 */
type ESymbols = Record<string, string> | undefined;
export function exprToStr(e: Expr, symbols: ESymbols): string {
  function subExpr(e: Expr): string {
    return exprToStr(e, symbols);
  }
  switch (e.node) {
    case 'field': {
      const ref = e.path.join('.');
      if (symbols) {
        if (symbols[ref] === undefined) {
          const nSyms = Object.keys(symbols).length;
          symbols[ref] = String.fromCharCode('A'.charCodeAt(0) + nSyms);
        }
        return symbols[ref];
      } else {
        return ref;
      }
    }
    case '()':
      return `(${subExpr(e.e)})`;
    case 'numberLiteral':
      return `${e.literal}`;
    case 'stringLiteral':
      return `{"${e.literal}"}`;
    case 'timeLiteral':
      return `@${e.literal}`;
    case 'recordLiteral': {
      const parts: string[] = [];
      for (const [name, val] of Object.entries(e.kids)) {
        parts.push(`${name}:${subExpr(val)}`);
      }
      return `{${parts.join(', ')}}`;
    }
    case 'arrayLiteral': {
      const parts = e.kids.values.map(k => subExpr(k));
      return `[${parts.join(', ')}]`;
    }
    case 'regexpLiteral':
      return `/${e.literal}/`;
    case 'trunc':
      return `{timeTrunc-${e.units} ${subExpr(e.e)}}`;
    case 'delta':
      return `{${e.op}${e.units} ${subExpr(e.kids.base)} ${subExpr(
        e.kids.delta
      )}}`;
    case 'true':
    case 'false':
      return e.node;
    case 'case': {
      const caseStmt = ['case'];
      if (e.kids.caseValue !== undefined) {
        caseStmt.push(`${subExpr(e.kids.caseValue)}`);
      }
      for (let i = 0; i < e.kids.caseWhen.length; i += 1) {
        caseStmt.push(
          `when ${subExpr(e.kids.caseWhen[i])} then ${subExpr(
            e.kids.caseThen[i]
          )}`
        );
      }
      if (e.kids.caseElse !== undefined) {
        caseStmt.push(`else ${subExpr(e.kids.caseElse)}`);
      }
      return `{${caseStmt.join(' ')}}`;
    }
    case 'regexpMatch':
      return `{${subExpr(e.kids.expr)} regex-match ${subExpr(e.kids.regex)}}`;
    case 'in': {
      return `{${subExpr(e.kids.e)} ${e.not ? 'not in' : 'in'} {${e.kids.oneOf
        .map(o => `${subExpr(o)}`)
        .join(',')}}}`;
    }
    case 'genericSQLExpr': {
      let sql = '';
      let i = 0;
      for (; i < e.kids.args.length; i++) {
        sql += `${e.src[i]}{${subExpr(e.kids.args[i])}}`;
      }
      if (i < e.src.length) {
        sql += e.src[i];
      }
      return sql;
    }
    case 'filterMatch': {
      let filterText = '';
      switch (e.dataType) {
        case 'string':
          filterText = StringFilterExpression.unparse(e.filter as StringClause);
          break;
        case 'number':
          filterText = NumberFilterExpression.unparse(e.filter as NumberClause);
          break;
        case 'date':
        case 'timestamp':
          filterText = TemporalFilterExpression.unparse(
            e.filter as TemporalClause
          );
          break;
        case 'boolean':
          filterText = BooleanFilterExpression.unparse(
            e.filter as BooleanClause
          );
          break;
        default:
          filterText = 'UNKOWN-FILTER';
      }
      const fType = `${e.dataType[0].toUpperCase()}${e.dataType.slice(1)}`;
      return `{filter${fType} ${subExpr(e.e)} | ${filterText}}`;
    }
  }
  if (exprHasKids(e) && e.kids['left'] && e.kids['right']) {
    return `{${subExpr(e.kids['left'])} ${e.node} ${subExpr(e.kids['right'])}}`;
  } else if (exprHasE(e)) {
    return `{${e.node} ${subExpr(e.e)}}`;
  } else if (exprIsLeaf(e)) {
    return `{${e.node}}`;
  }
  return `{?${e.node}}`;
}
