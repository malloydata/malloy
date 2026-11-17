/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  BooleanFilter,
  NumberFilter,
  StringFilter,
  TemporalFilter,
} from '@malloydata/malloy-filter';
import {
  BooleanFilterExpression,
  NumberFilterExpression,
  StringFilterExpression,
  TemporalFilterExpression,
} from '@malloydata/malloy-filter';
import type {
  ActiveJoin,
  Expr,
  FieldDef,
  FilterCondition,
  FilterExprType,
} from '../model/malloy_types';
import {
  expressionIsScalar,
  hasExpression,
  isAtomic,
  isJoined,
  isSourceDef,
} from '../model/malloy_types';
import {pathToKey} from '../model/utils';

type JoinSet = Map<string, string[]>;

/**
 * Marks each active join the segment's filters require `inner`.
 *
 * A join is *required* by a query's filters when they keep no row in which
 * that join is unmatched: the row of NULLs a left join writes where nothing
 * matched could never pass the `where:`. A required join can be written as
 * an INNER join, since the rows it would drop are the rows the `where:`
 * drops anyway.
 *
 * Proving this means showing that a filter is never TRUE when every column
 * of the join is NULL. The proof is built only from operations whose SQL
 * passes a NULL through; anything else, a `??`, a `pick`, a function call,
 * or Malloy's own `!=` and `not` (which turn NULL into true) proves nothing
 * about the joins beneath it. A join this cannot prove required stays a
 * left join, so a gap here costs only the optimization.
 */
export function markInnerJoins(
  activeJoins: ActiveJoin[],
  filters: FilterCondition[],
  lookup: (path: string[]) => FieldDef | undefined
): ActiveJoin[] {
  const required = findRequiredJoins(filters, lookup);
  return activeJoins.map((j): ActiveJoin =>
    required.has(joinKey(j.path)) && isLeftJoinedSource(lookup(j.path))
      ? {...j, inner: true}
      : j
  );
}

function findRequiredJoins(
  filters: FilterCondition[],
  lookup: (path: string[]) => FieldDef | undefined
): Set<string> {
  const required = new Set<string>();
  const pending: string[][] = [];
  const add = (joins: JoinSet) => {
    for (const [key, path] of joins) {
      if (!required.has(key)) {
        required.add(key);
        pending.push(path);
      }
    }
  };

  // `where:` and `having:` share one filter list. The compiler writes a
  // scalar filter in WHERE, whichever clause it came from, and anything
  // else in HAVING, so the scalar ones are those which keep rows from the
  // joins. A `having:` naming an output column reads it as an
  // `outputField`, which proves nothing here.
  const walker = new NullWalker(lookup);
  for (const f of filters) {
    if (expressionIsScalar(f.expressionType)) {
      add(walker.rejects(f.e, []));
    }
  }

  // A required join whose `on` can't be true when another join is unmatched
  // makes that join required too: without it, the required join is
  // unmatched as well. A right or full join keeps its own rows when its
  // `on` fails, so its `on` proves nothing.
  while (pending.length > 0) {
    const path = pending.pop();
    if (path === undefined) break;
    const def = lookup(path);
    if (
      def &&
      isJoined(def) &&
      def.onExpression &&
      ['left', 'inner'].includes(def.matrixOperation ?? 'left')
    ) {
      add(walker.rejects(def.onExpression, path.slice(0, -1)));
    }
  }
  return required;
}

function isLeftJoinedSource(def: FieldDef | undefined): boolean {
  return (
    def !== undefined &&
    isSourceDef(def) &&
    isJoined(def) &&
    (def.matrixOperation ?? 'left') === 'left'
  );
}

function joinKey(path: string[]): string {
  return pathToKey('join', path);
}

function union(...sets: JoinSet[]): JoinSet {
  const out: JoinSet = new Map();
  for (const s of sets) {
    for (const [k, v] of s) out.set(k, v);
  }
  return out;
}

function intersect(a: JoinSet, b: JoinSet): JoinSet {
  const out: JoinSet = new Map();
  for (const [k, v] of a) {
    if (b.has(k)) out.set(k, v);
  }
  return out;
}

/**
 * Expressions are written in the namespace of a struct, `prefix`, a path
 * from the query's source; a field in the expression is found at
 * `[...prefix, ...field.path]`.
 */
class NullWalker {
  constructor(readonly lookup: (path: string[]) => FieldDef | undefined) {}

  /**
   * The joins any one of which, unmatched, makes `e` NULL.
   */
  nullWhenUnmatched(e: Expr, prefix: string[]): JoinSet {
    switch (e.node) {
      case 'field':
        return this.fieldNullWhenUnmatched([...prefix, ...e.path]);
      case '()':
      case 'unary-':
      case 'cast':
      case 'trunc':
      case 'extract':
        return this.nullWhenUnmatched(e.e, prefix);
      case '+':
      case '-':
      case '*':
      case '/':
      case '%':
      case '=':
      case '<':
      case '>':
      case '<=':
      case '>=':
      case 'like':
        return union(
          this.nullWhenUnmatched(e.kids.left, prefix),
          this.nullWhenUnmatched(e.kids.right, prefix)
        );
      case 'delta':
        return union(
          this.nullWhenUnmatched(e.kids.base, prefix),
          this.nullWhenUnmatched(e.kids.delta, prefix)
        );
      case 'regexpMatch':
        return union(
          this.nullWhenUnmatched(e.kids.expr, prefix),
          this.nullWhenUnmatched(e.kids.regex, prefix)
        );
      // `x IN (...)` and `x NOT IN (...)` are both NULL when x is.
      case 'in':
        return this.nullWhenUnmatched(e.kids.e, prefix);
      default:
        return new Map();
    }
  }

  /**
   * The joins any one of which, unmatched, keeps the condition `e` from
   * being TRUE.
   */
  rejects(e: Expr, prefix: string[]): JoinSet {
    switch (e.node) {
      case 'filterCondition':
      case '()':
        return this.rejects(e.e, prefix);
      case 'and':
        return union(
          this.rejects(e.kids.left, prefix),
          this.rejects(e.kids.right, prefix)
        );
      case 'or':
        return intersect(
          this.rejects(e.kids.left, prefix),
          this.rejects(e.kids.right, prefix)
        );
      case 'is-not-null':
        return this.nullWhenUnmatched(e.e, prefix);
      // `not (x is null)` is false, not NULL, when x is NULL.
      case 'not':
        return e.e.node === 'is-null'
          ? this.nullWhenUnmatched(e.e.e, prefix)
          : new Map();
      // An unbound or empty given makes `x in given` false; otherwise it is
      // NULL when x is. `not in` an empty given is true.
      case 'inGiven':
        return e.not ? new Map() : this.nullWhenUnmatched(e.e, prefix);
      case 'filterMatch': {
        let filter = e.kids.filterExpr;
        while (filter.node === '()') filter = filter.e;
        if (
          filter.node === 'filterLiteral' &&
          filterRejectsNull(e.dataType, filter.filterSrc)
        ) {
          return this.nullWhenUnmatched(e.kids.expr, prefix);
        }
        return new Map();
      }
      case 'field': {
        const path = [...prefix, ...e.path];
        const def = this.lookup(path);
        if (
          def &&
          hasExpression(def) &&
          expressionIsScalar(def.expressionType)
        ) {
          return this.rejects(def.e, path.slice(0, -1));
        }
        return this.nullWhenUnmatched(e, prefix);
      }
      default:
        return this.nullWhenUnmatched(e, prefix);
    }
  }

  private fieldNullWhenUnmatched(path: string[]): JoinSet {
    const def = this.lookup(path);
    if (def === undefined || !isAtomic(def) || def.type === 'array') {
      return new Map();
    }
    if (hasExpression(def)) {
      return expressionIsScalar(def.expressionType)
        ? this.nullWhenUnmatched(def.e, path.slice(0, -1))
        : new Map();
    }
    // A column is NULL when the innermost joined source above it is
    // unmatched. A stored record between them is a column of that source,
    // and so is NULL with it. A computed record is built by its expression,
    // which need not be NULL, and an array is not a column of the source, so
    // a path through either proves nothing.
    let owner: string[] | undefined;
    for (let len = 1; len < path.length; len++) {
      const above = this.lookup(path.slice(0, len));
      if (above === undefined || !isJoined(above)) {
        return new Map();
      }
      if (isSourceDef(above)) {
        owner = path.slice(0, len);
      } else if (above.type !== 'record' || hasExpression(above)) {
        return new Map();
      }
    }
    return owner === undefined ? new Map() : new Map([[joinKey(owner), owner]]);
  }
}

/**
 * Whether a filter expression, applied to NULL, is never TRUE. This reads
 * the filter as the SQL `FilterCompilers` writes it: a negated clause
 * usually adds `OR x IS NULL`, so no negated clause proves anything except
 * `not null`.
 */
function filterRejectsNull(dataType: FilterExprType, src: string): boolean {
  switch (dataType) {
    case 'string': {
      const parsed = StringFilterExpression.parse(src).parsed;
      return parsed !== null && stringRejectsNull(parsed);
    }
    case 'number': {
      const parsed = NumberFilterExpression.parse(src).parsed;
      return parsed !== null && numberRejectsNull(parsed);
    }
    case 'boolean': {
      const parsed = BooleanFilterExpression.parse(src).parsed;
      return parsed !== null && booleanRejectsNull(parsed);
    }
    case 'date':
    case 'timestamp':
    case 'timestamptz': {
      const parsed = TemporalFilterExpression.parse(src).parsed;
      return parsed !== null && temporalRejectsNull(parsed);
    }
  }
}

function stringRejectsNull(f: StringFilter): boolean {
  switch (f.operator) {
    case '=':
    case 'contains':
    case 'starts':
    case 'ends':
    case '~':
    case 'none':
      return !f.not;
    case 'null':
    case 'empty':
      return f.not === true;
    case '()':
      return !f.not && stringRejectsNull(f.expr);
    case 'and':
      return f.members.some(stringRejectsNull);
    case 'or':
      return f.members.every(stringRejectsNull);
    // A list ORs what it includes, and adds `x IS NULL` for a `null` or
    // `empty` in it.
    case ',':
      return f.members.every(
        m =>
          !('not' in m && m.not) &&
          m.operator !== 'null' &&
          m.operator !== 'empty' &&
          stringRejectsNull(m)
      );
  }
}

function numberRejectsNull(f: NumberFilter): boolean {
  switch (f.operator) {
    case '=':
    case '>':
    case '<':
    case '>=':
    case '<=':
    case 'range':
    case 'none':
      return !f.not;
    case '!=':
      return false;
    case 'null':
      return f.not === true;
    case '()':
      return !f.not && numberRejectsNull(f.expr);
    case 'and':
      return f.members.some(numberRejectsNull);
    case 'or':
      return f.members.every(numberRejectsNull);
  }
}

function booleanRejectsNull(f: BooleanFilter): boolean {
  switch (f.operator) {
    case 'true':
    case '=true':
    case '=false':
    case 'none':
      return !f.not;
    case 'false':
      return false;
    case 'null':
      return f.not === true;
  }
}

function temporalRejectsNull(f: TemporalFilter): boolean {
  switch (f.operator) {
    case 'before':
    case 'after':
    case 'to':
    case 'for':
    case 'in_last':
    case 'last':
    case 'next':
    case 'in':
    case 'none':
      return !f.not;
    case 'null':
      return f.not === true;
    case '()':
      return !f.not && temporalRejectsNull(f.expr);
    case 'and':
      return f.members.some(temporalRejectsNull);
    case 'or':
      return f.members.every(temporalRejectsNull);
  }
}
