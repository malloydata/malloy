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
import {
  Expr,
  exprHasE,
  exprHasKids,
  ExprWithKids,
  GenericSQLExpr,
} from './malloy_types';

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
