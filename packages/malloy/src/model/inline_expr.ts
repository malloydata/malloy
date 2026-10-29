/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Note: this is the first JS-side constant folder in the Malloy
// compiler. If a general fold helper ever lands, replace `inlineExpr`
// with a call into it rather than growing a second evaluator.

import type {Expr, GivenID} from './malloy_types';

/**
 * Operator node types allowed inside an `inline` given's default. Single
 * source of truth — both the translator-side validator
 * (`GivenDeclaration.execute`) and the bind-time evaluator below read
 * this set when deciding whether an expression is reducible to a
 * literal at bind time.
 *
 * Add a new operator here AND a corresponding `case` to `inlineExpr`'s
 * switch in the same commit; the two are intentionally co-located so
 * they can't drift apart.
 */
export const INLINE_OPS: ReadonlySet<string> = new Set<string>([
  'and',
  'or',
  'not',
  '=',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  'inGiven',
  '()',
]);

/**
 * Leaf-shaped node types that are valid inside an inline expression but
 * aren't "operators." Literals are returned as-is by the evaluator;
 * `given` nodes resolve through the bound values map.
 */
export const INLINE_LEAVES: ReadonlySet<string> = new Set<string>([
  'stringLiteral',
  'numberLiteral',
  'true',
  'false',
  'null',
  'arrayLiteral',
  'given',
]);

/**
 * Bind-time evaluator for `inline` given defaults. Walks the Expr tree
 * and returns a literal Expr (string/number/boolean/null/arrayLiteral).
 *
 * A pure folder: it does not know how given references get their values.
 * `resolveGiven` is handed a given reference's id and surface name (both
 * a `$NAME` ref and the array of an `expr in $NAME`) and returns the Expr
 * that reference stands for — caller-supplied value, declaration default,
 * or a thrown error if neither. That policy lives with the caller
 * (`given_binding.ts`), not here — see `lookupGivenValue`.
 *
 * Throws on any node outside `INLINE_OPS ∪ INLINE_LEAVES`. The
 * translator's pre-flight check should have rejected such defaults
 * already, so a throw here flags a compiler bug rather than a caller
 * error.
 */
export function inlineExpr(
  e: Expr,
  resolveGiven: (id: GivenID, refName: string) => Expr
): Expr {
  switch (e.node) {
    case 'stringLiteral':
    case 'numberLiteral':
    case 'true':
    case 'false':
    case 'null':
    case 'arrayLiteral':
      return e;
    case 'given':
      return inlineExpr(resolveGiven(e.id, e.refName), resolveGiven);
    case '()':
      return inlineExpr(e.e, resolveGiven);
    case 'not': {
      const inner = inlineExpr(e.e, resolveGiven);
      return toBoolLiteral(!exprAsBool(inner));
    }
    case 'and':
    case 'or': {
      const left = exprAsBool(inlineExpr(e.kids.left, resolveGiven));
      const right = exprAsBool(inlineExpr(e.kids.right, resolveGiven));
      return toBoolLiteral(e.node === 'and' ? left && right : left || right);
    }
    case '=':
    case '!=':
    case '>':
    case '<':
    case '>=':
    case '<=': {
      const left = inlineExpr(e.kids.left, resolveGiven);
      const right = inlineExpr(e.kids.right, resolveGiven);
      return toBoolLiteral(compareLiterals(e.node, left, right));
    }
    case 'inGiven': {
      const lhs = inlineExpr(e.e, resolveGiven);
      const arr = inlineExpr(
        resolveGiven(e.givenRef.id, e.givenRef.refName),
        resolveGiven
      );
      if (arr.node === 'null') {
        return toBoolLiteral(e.not);
      }
      if (arr.node !== 'arrayLiteral') {
        throw new Error(
          `inlineExpr: 'inGiven' resolved to '${arr.node}', expected 'arrayLiteral'`
        );
      }
      const found = arr.kids.values.some(v =>
        compareLiterals('=', lhs, inlineExpr(v, resolveGiven))
      );
      return toBoolLiteral(e.not ? !found : found);
    }
    default:
      throw new Error(
        `inlineExpr: unexpected node '${e.node}' — translator should have rejected this`
      );
  }
}

function toBoolLiteral(b: boolean): Expr {
  return {node: b ? 'true' : 'false'};
}

/**
 * Read a literal Expr as a JS boolean. The evaluator only ever produces
 * 'true' / 'false' / 'null' / scalar literals here; anything else means
 * we tried to use a non-boolean where a boolean was expected, which is a
 * translator type-check bug.
 */
function exprAsBool(e: Expr): boolean {
  if (e.node === 'true') return true;
  if (e.node === 'false') return false;
  // `null` in boolean position is treated as false — matches the
  // implicit SQL coalesce that Malloy does for filter expressions.
  if (e.node === 'null') return false;
  throw new Error(
    `inlineExpr: expected boolean literal, got '${e.node}' — translator should have type-checked this`
  );
}

/**
 * JS-side comparison of two literal Exprs. Only the literal nodes
 * produced by the evaluator are supported.
 *
 * SQL nullability: any operand being null produces false (matching
 * Malloy's COALESCE-to-true / COALESCE-to-false behavior elsewhere).
 */
function compareLiterals(
  op: '=' | '!=' | '>' | '<' | '>=' | '<=',
  left: Expr,
  right: Expr
): boolean {
  if (left.node === 'null' || right.node === 'null') {
    // Mirror SQL: comparisons with NULL are unknown; treat as false for
    // = / > / < / >= / <=, true for !=.
    return op === '!=';
  }
  const l = literalToJS(left);
  const r = literalToJS(right);
  switch (op) {
    case '=':
      return l === r;
    case '!=':
      return l !== r;
    case '>':
      return l > r;
    case '<':
      return l < r;
    case '>=':
      return l >= r;
    case '<=':
      return l <= r;
  }
}

/**
 * Convert a literal Expr to a comparable JS value. Numbers come through
 * `numberLiteral` as a string (full precision preserved); we parse to a
 * JS number for ordering — bind-time precision loss here is fine
 * because the result of an inline expression is a boolean for SQL.
 */
function literalToJS(e: Expr): string | number | boolean {
  switch (e.node) {
    case 'stringLiteral':
      return e.literal;
    case 'numberLiteral':
      return Number(e.literal);
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      throw new Error(
        `inlineExpr: cannot compare non-literal node '${e.node}'`
      );
  }
}
