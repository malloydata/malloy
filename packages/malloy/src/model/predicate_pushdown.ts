/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Predicate pushdown into a join written as a subquery.
 *
 * A join whose on clause reaches into data nested inside it, or a filtered
 * join, is written as a subquery which unnests its nested data before the
 * join (see "Joins written as subqueries" in CONTEXT.md). The database cannot
 * filter array elements without unnesting them, so a query `where:` on the
 * joined source's nested data still pays for unnesting every row of it.
 *
 * Here a condition of the query's `where:` is copied into the subquery, so it
 * runs before the unnest, and the original stays where it is. A condition on
 * the joined row is copied as written. A condition on the elements of one of
 * the joined row's arrays becomes "the row has an element where ...". A
 * condition on the query's own join key is first rewritten, through the ON
 * equality, into a condition on the joined side.
 *
 * The copy can only remove joined rows which the original condition would
 * remove anyway, as long as the condition rejects nulls: a LEFT JOIN turns a
 * removed row into a null-extended one, which the original must still reject.
 * So only comparisons of a field with constants are copied; Malloy's `!=`
 * also matches nulls, and is not one of them.
 */

import type {QueryStruct} from './query_node';
import {QueryFieldStruct} from './query_node';
import type {Expr, FieldnameNode} from './malloy_types';
import {hasExpression} from './malloy_types';
import {exprWalk} from './utils';

/** The conditions an expression is the AND of, through parentheses. */
export function conjuncts(e: Expr): Expr[] {
  if (e.node === '()') return conjuncts(e.e);
  if (e.node === 'and') {
    return [...conjuncts(e.kids.left), ...conjuncts(e.kids.right)];
  }
  return [e];
}

function unwrap(e: Expr): Expr {
  return e.node === '()' ? unwrap(e.e) : e;
}

function isConstant(e: Expr): boolean {
  switch (unwrap(e).node) {
    case 'numberLiteral':
    case 'stringLiteral':
    case 'dateLiteral':
    case 'timestampLiteral':
    case 'timestamptzLiteral':
    case 'true':
    case 'false':
      return true;
    default:
      return false;
  }
}

function isField(e: Expr): boolean {
  return unwrap(e).node === 'field';
}

/**
 * Whether a condition is safe to copy: a comparison of one field with a
 * constant, or a field `in` a list of constants, each of which is false or
 * null when the field is null.
 */
export function isCopyableCondition(e: Expr): boolean {
  switch (e.node) {
    case '()':
      return isCopyableCondition(e.e);
    case '=':
    case '<':
    case '>':
    case '<=':
    case '>=':
    case 'like': {
      const {left, right} = e.kids;
      return (
        (isField(left) && isConstant(right)) ||
        (isConstant(left) && isField(right))
      );
    }
    case 'in':
      return !e.not && isField(e.kids.e) && e.kids.oneOf.every(isConstant);
    default:
      return false;
  }
}

function fieldNodes(e: Expr): FieldnameNode[] {
  const fields: FieldnameNode[] = [];
  for (const node of exprWalk(e)) {
    if (node.node === 'field') fields.push(node);
  }
  return fields;
}

/**
 * The struct whose rows a path's value comes from, read from `from`: the
 * innermost join along it, where an unnested array is a join of its own. A
 * computed field comes from wherever its expression reads, and has to read
 * from one place only. Undefined when the path does not resolve, or reads
 * from more than one place.
 */
function rowSource(from: QueryStruct, path: string[]): QueryStruct | undefined {
  const fields = from.getFieldsAlongPath(path);
  if (fields === undefined) return undefined;
  let source = from.getJoinableParent();
  for (const field of fields) {
    if (field instanceof QueryFieldStruct) {
      const struct = field.queryStruct;
      if (struct.getJoinableParent() === struct) source = struct;
    } else if (hasExpression(field.fieldDef)) {
      const reads = conditionSource(field.parent, field.fieldDef.e);
      return reads === 'constant' ? source : reads;
    }
  }
  return source;
}

/**
 * The struct whose rows every field of `e` comes from, read from `from`;
 * 'constant' when it reads no field; undefined when its fields come from
 * more than one place.
 */
export function conditionSource(
  from: QueryStruct,
  e: Expr
): QueryStruct | 'constant' | undefined {
  let source: QueryStruct | 'constant' = 'constant';
  for (const field of fieldNodes(e)) {
    const fieldSource = rowSource(from, field.path);
    if (fieldSource === undefined) return undefined;
    if (source !== 'constant' && fieldSource !== source) return undefined;
    source = fieldSource;
  }
  return source;
}

function samePath(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/**
 * Each `field = field` equality of an on clause, as [one side, other side]
 * both ways round.
 */
function onEqualities(on: Expr): [string[], string[]][] {
  const pairs: [string[], string[]][] = [];
  for (const c of conjuncts(on)) {
    if (c.node !== '=') continue;
    const left = unwrap(c.kids.left);
    const right = unwrap(c.kids.right);
    if (left.node === 'field' && right.node === 'field') {
      pairs.push([left.path, right.path], [right.path, left.path]);
    }
  }
  return pairs;
}

/**
 * A condition which reads only one side of a join's ON equality, rewritten to
 * read the other side instead: with `on genre = movies.genres.each`, the
 * condition `genre = 'Emma'` becomes `movies.genres.each = 'Emma'`. The ON
 * holds for every joined row, so the two say the same thing about it.
 * Undefined unless every field of the condition is the one side of one
 * equality, and the other side comes from `onto`.
 */
export function rewriteThroughOn(
  e: Expr,
  on: Expr,
  from: QueryStruct,
  isOnto: (source: QueryStruct) => boolean
): Expr | undefined {
  const fields = fieldNodes(e);
  if (fields.length === 0) return undefined;
  for (const [side, other] of onEqualities(on)) {
    if (!fields.every(f => samePath(f.path, side))) continue;
    const otherSource = rowSource(from, other);
    if (otherSource === undefined || !isOnto(otherSource)) continue;
    const rewritten = structuredClone(e);
    for (const node of fieldNodes(rewritten)) {
      node.path = [...other];
    }
    return rewritten;
  }
  return undefined;
}
