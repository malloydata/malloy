/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {v5 as uuidv5} from 'uuid';
import md5 from 'blueimp-md5';
import type {
  Expr,
  ExprWithKids,
  GenericSQLExpr,
  StructDef,
} from './malloy_types';
import {
  exprHasE,
  exprHasKids,
  fieldIsIntrinsic,
  getIdentifier,
} from './malloy_types';
import type {DialectFieldList} from '../dialect';

/** simple indent function */
export function indent(s: string): string {
  const re = /(^|\n)/g;
  const lastNewline = /\n {2}$/;
  return s.replace(re, '$1  ').replace(lastNewline, '\n');
}

/**
 * Generate a SQL string literal from a given `input` string, safe, e.g., to be used in `WHERE` clauses.
 */
export function generateSQLStringLiteral(input: string): string {
  const escapedString = input.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${escapedString}'`;
}

/**
 * WHERE and HAVING clauses are built out of a chain of boolean experssions
 * joined with AND.
 */
export class AndChain {
  private clauses: string[] = [];
  constructor(intial?: string) {
    if (intial) {
      this.clauses.push(intial);
    }
  }

  clone(): AndChain {
    const theClone = new AndChain();
    theClone.addChain(this);
    return theClone;
  }

  add(clause: string): AndChain {
    this.clauses.push(clause);
    return this;
  }

  addChain(andChain: AndChain): AndChain {
    this.clauses.push(...andChain.clauses);
    return this;
  }

  empty(): boolean {
    return this.clauses.length === 0;
  }

  present(): boolean {
    return this.clauses.length > 0;
  }

  sqlOr(): string {
    if (this.empty()) {
      return '';
    }
    return this.clauses.map(c => `(${c})`).join('OR ') + '\n';
  }

  sql(whereOrHaving?: 'where' | 'having'): string {
    if (this.empty()) {
      return '';
    }

    let prefix = '';
    let postfix = '';
    if (whereOrHaving) {
      prefix = whereOrHaving.toUpperCase() + ' ';
      postfix = '\n';
    }
    if (this.clauses.length === 1) {
      return prefix + this.clauses[0] + postfix;
    }
    return prefix + this.clauses.map(c => `(${c})`).join('\nAND ') + postfix;
  }
}

export function generateHash(input: string): string {
  const MALLOY_UUID = '76c17e9d-f3ce-5f2d-bfde-98ad3d2a37f6';
  return uuidv5(input, MALLOY_UUID);
}

/**
 * Compute a digest for lookup/identity purposes (not cryptographic).
 *
 * Uses blueimp-md5 for these reasons:
 * - Works in both Node.js and browsers (no native crypto dependency)
 * - Synchronous API (unlike Web Crypto which is async)
 * - Well-maintained by Sebastian Tschan (blueimp), a known maintainer
 * - High adoption (~1.7M weekly downloads)
 * - MD5 is fast and produces short hex strings - perfect for cache keys
 *
 * Takes variable string arguments and combines them in a collision-resistant
 * way by including the length of each string (similar to pathToKey pattern).
 */
export function makeDigest(...parts: string[]): string {
  // Combine parts with length prefix to avoid collisions
  // e.g., ("ab", "c") vs ("a", "bc") both concat to "abc"
  // but with lengths: "2:ab/1:c" vs "1:a/2:bc"
  const combined = parts.map(p => `${p.length}:${p}`).join('/');
  return md5(combined);
}

export function joinWith<T>(els: T[][], sep: T): T[] {
  const result: T[] = [];
  for (let i = 0; i < els.length; i++) {
    result.push(...els[i]);
    if (i < els.length - 1) {
      result.push(sep);
    }
  }
  return result;
}

export function range(start: number, end: number): number[] {
  return Array.from({length: end - start}, (_, index) => index + start);
}

export function* exprKids(eNode: Expr): IterableIterator<Expr> {
  if (exprHasKids(eNode)) {
    for (const kidEnt of Object.values(eNode.kids)) {
      if (Array.isArray(kidEnt)) {
        yield* kidEnt;
      } else if (kidEnt !== null) {
        yield kidEnt;
      }
    }
  } else if (exprHasE(eNode)) {
    yield eNode.e;
  }
}
export function* exprWalk(
  eNode: Expr,
  order: 'pre' | 'post' = 'post'
): IterableIterator<Expr> {
  if (order === 'pre') {
    yield eNode;
  }
  for (const kid of exprKids(eNode)) {
    yield* exprWalk(kid, order);
  }
  if (order === 'post') {
    yield eNode;
  }
}

export function exprMap(eNode: Expr, mapFunc: (e: Expr) => Expr): Expr {
  let mapExpr = {...eNode};
  if (exprHasKids(eNode)) {
    const parentNode: ExprWithKids = {...eNode};
    parentNode.kids = {};
    for (const [name, kidEnt] of Object.entries(eNode.kids)) {
      if (Array.isArray(kidEnt)) {
        parentNode.kids[name] = kidEnt.map(kidEl => mapFunc(kidEl));
      } else if (kidEnt !== null) {
        parentNode.kids[name] = mapFunc(kidEnt);
      }
    }
    mapExpr = parentNode as Expr;
  }
  if (exprHasE(mapExpr)) {
    mapExpr.e = mapFunc(mapExpr.e);
  }
  return mapFunc(mapExpr);
}
export type SQLExprElement = string | Expr;

/**
 * Take a mixed array of strings and Expr and turn it into an SQLExpr
 * expression node.
 */
export function composeSQLExpr(from: SQLExprElement[]): GenericSQLExpr {
  const ret: GenericSQLExpr = {
    node: 'genericSQLExpr',
    kids: {args: []},
    src: [],
  };
  // Build the array of alternating strings and expressions
  let lastWasString = false;
  for (const el of from) {
    if (typeof el === 'string') {
      if (lastWasString) {
        ret.src[ret.src.length - 1] += el;
      } else {
        ret.src.push(el);
      }
      lastWasString = true;
    } else {
      if (!lastWasString) {
        ret.src.push('');
      }
      ret.kids.args.push(el);
      lastWasString = false;
    }
  }
  return ret;
}

export function getDialectFieldList(structDef: StructDef): DialectFieldList {
  const dialectFieldList: DialectFieldList = [];

  for (const f of structDef.fields.filter(fieldIsIntrinsic)) {
    dialectFieldList.push({
      typeDef: f,
      sqlExpression: getIdentifier(f),
      rawName: getIdentifier(f),
      sqlOutputName: getIdentifier(f),
    });
  }
  return dialectFieldList;
}

/**
 * A little extra paranoia to save us from fields which contain the special
 * characters used to build the grouping key.
 */
export function pathToKey(node: string, fields: string[]): string {
  return node + `/${fields.map(f => `${f.length}:${f}`).join(',')}`;
}

export function groupingKey(node: string, fields: string[]): string {
  const sortedFields = [...fields].sort();
  return pathToKey(node, sortedFields);
}

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
