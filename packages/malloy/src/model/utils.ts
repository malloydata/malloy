/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {v4 as uuidv4, v5 as uuidv5} from 'uuid';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils';
import type {
  AtomicTypeDef,
  Expr,
  ExprWithKids,
  FieldDef,
  GenericSQLExpr,
  GivenTypeDef,
  ModelDef,
  ModelID,
  StructDef,
} from './malloy_types';
import {
  exprHasE,
  exprHasKids,
  fieldIsIntrinsic,
  activeName,
  mkSafeRecord,
} from './malloy_types';
import type {DialectFieldList} from '../dialect';

/**
 * Format a typeDef as user-readable Malloy type syntax. Used in error
 * messages where we want to echo a compound type back to the user in the
 * same form they wrote it.
 *
 *   `string`               → `string`
 *   `string[]`             → `string[]`
 *   `{a::string, b::number}` → `{a :: string, b :: number}`
 *   `{a::string}[]`        → `{a :: string}[]`
 *   `filter<string>`       → `filter<string>`
 *   sql-native rawType     → `sql native: jsonb`
 */
export function typeDefToString(
  td: AtomicTypeDef | GivenTypeDef | FieldDef
): string {
  switch (td.type) {
    case 'array':
      // Repeated record (`elementTypeDef.type === 'record_element'`) carries
      // its schema in `fields` on the array itself; basic arrays carry it
      // in `elementTypeDef`.
      if (td.elementTypeDef.type === 'record_element' && 'fields' in td) {
        return `${recordFieldsToString(td.fields)}[]`;
      }
      if (td.elementTypeDef.type !== 'record_element') {
        return `${typeDefToString(td.elementTypeDef)}[]`;
      }
      return 'array';
    case 'record':
      return recordFieldsToString(td.fields);
    case 'filter expression':
      return `filter<${td.filterType}>`;
    case 'sql native':
      return td.rawType ? `sql native: ${td.rawType}` : 'sql native';
    default:
      return td.type;
  }
}

function recordFieldsToString(fields: FieldDef[]): string {
  return `{${fields
    .map(f => `${f.name} :: ${typeDefToString(f)}`)
    .join(', ')}}`;
}

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
 * Compute a digest for lookup/identity purposes.
 *
 * Uses @noble/hashes sha256:
 * - Works in both Node.js and browsers (no native crypto dependency)
 * - Synchronous API (unlike Web Crypto which is async)
 * - SHA-256 is appropriate since inputs may contain connection credentials
 *
 * Takes variable string arguments and combines them in a collision-resistant
 * way by including the length of each string (similar to pathToKey pattern).
 */
export function makeDigest(...parts: (string | undefined)[]): string {
  // Combine parts with length prefix to avoid collisions
  // e.g., ("ab", "c") vs ("a", "bc") both concat to "abc"
  // but with lengths: "2:ab/1:c" vs "1:a/2:bc"
  // undefined is distinct from empty string in the hash
  const combined = parts
    .map(p => (p === undefined ? '{undefined}' : `${p.length}:${p}`))
    .join('/');
  // @noble/hashes is pinned to v1 (v2 is ESM-only — see DEPENDENCY-MANAGEMENT.md).
  // v1's sha256 also accepts a string directly, but we utf8-encode explicitly so the
  // digest is stable and unambiguous (and identical to the v2 form we briefly used).
  return bytesToHex(sha256(utf8ToBytes(combined)));
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
      sqlExpression: activeName(f),
      rawName: activeName(f),
      sqlOutputName: activeName(f),
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

/**
 * Make a {@link ModelID} for a model. Pass the model's URL for a real model;
 * omit it for a URL-less model to get a synthetic `"internal <uuid>"` id. The
 * space makes the synthetic form an illegal URL so it can never collide with a
 * real model URL.
 */
export function mkModelID(url?: string): ModelID {
  return url ?? `internal ${uuidv4()}`;
}

/**
 * Create an empty ModelDef with the given name.
 * Use this factory to ensure all required fields are present.
 */
export function mkModelDef(
  name: string,
  modelID: ModelID = mkModelID()
): ModelDef {
  return {
    name,
    modelID,
    exports: [],
    contents: mkSafeRecord(),
    sourceRegistry: {},
    modelAnnotations: {},
    queryList: [],
    dependencies: {},
  };
}
