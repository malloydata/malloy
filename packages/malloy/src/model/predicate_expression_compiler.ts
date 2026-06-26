/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Expr,
  FilterCondition,
  Given,
  GivenID,
  QuerySegment,
  SourceDef,
  TurtleDef,
} from './malloy_types';
import {expressionIsScalar, isBaseTable} from './malloy_types';
import type {QueryInfo} from '../dialect';
import {exprToSQL} from './expression_compiler';
import {AndChain} from './utils';
import {QueryStruct, type ModelRootInterface} from './query_node';
import type {EventStream} from '../runtime_types';
import {FieldInstanceResultRoot} from './field_instance';
import type {JoinInstance} from './join_instance';

/**
 * Minimal FieldInstanceResultRoot for compiling a source's access predicate.
 * A predicate over the source's own columns never touches output fields or
 * the group-set machinery, so almost everything here is the empty/identity
 * value. `getQueryInfo` carries the source's query timezone so temporal
 * literals in the predicate render correctly.
 *
 * Mirrors `ConstantFieldInstanceResultRoot` in constant_expression_compiler.ts.
 */
class PredicateFieldInstanceResultRoot extends FieldInstanceResultRoot {
  override joins = new Map<string, JoinInstance>();
  override havings = new AndChain();
  override isComplexQuery = false;
  override queryUsesPartitioning = false;
  override computeOnlyGroups: number[] = [];
  override elimatedComputeGroups = false;

  constructor(private readonly queryTimezone: string) {
    const minimalTurtleDef: TurtleDef = {
      type: 'turtle',
      name: '__predicate__',
      pipeline: [],
    };
    super(minimalTurtleDef);

    const minimalOutputStruct: SourceDef = {
      type: 'table',
      name: '__predicate_output__',
      fields: [],
      tablePath: '__predicate__',
      connection: '__predicate__',
      dialect: 'standardsql',
    };
    const minimalSegment: QuerySegment = {
      type: 'project',
      filterList: [],
      queryFields: [],
      outputStruct: minimalOutputStruct,
      isRepeated: false,
    };
    this.firstSegment = minimalSegment;
  }

  override root(): FieldInstanceResultRoot {
    return this;
  }

  override getQueryInfo(): QueryInfo {
    return {queryTimezone: this.queryTimezone};
  }
}

/**
 * QueryStruct rooted at a real source, used to compile that source's access
 * predicate in isolation. Unlike `ConstantQueryStruct` it keeps the inherited
 * `getFieldByName` so the predicate's column references resolve against the
 * source's own fields. The only override is `getIdentifier`: the host splices
 * the returned fragment into its own SQL, so top-level columns are qualified
 * with a caller-supplied alias (default `base`) rather than Malloy's hardcoded
 * `base`.
 */
class PredicateQueryStruct extends QueryStruct {
  constructor(
    source: SourceDef,
    modelGivens: Record<GivenID, Given>,
    resolvedGivens: Map<GivenID, Expr> | undefined,
    private readonly tableAlias: string,
    eventStream?: EventStream
  ) {
    const model: ModelRootInterface = {
      structs: new Map(),
      givens: modelGivens,
    };
    super(source, undefined, {model}, {eventStream, resolvedGivens});
  }

  override getIdentifier(): string {
    if (isBaseTable(this.structDef)) {
      return this.tableAlias;
    }
    return super.getIdentifier();
  }
}

export type PredicateExpressionResult =
  | {sql: string; error?: undefined}
  | {sql?: undefined; error: string};

/**
 * Compile a source's access filters to a single dialect-appropriate SQL boolean
 * expression (a bare WHERE fragment, no `WHERE` keyword). Multiple filters are
 * AND-ed together. Field references are resolved against `source` and qualified
 * with `tableAlias`; given references are resolved from `resolvedGivens` (with
 * declaration defaults via `modelGivens`).
 *
 * `tableAlias` must be a bare SQL identifier (`[A-Za-z_][A-Za-z0-9_]*`); it is
 * interpolated directly into the emitted SQL, so anything else returns `{error}`
 * rather than risk injection.
 *
 * A source with no access filters yields `'true'` (no restriction = match-all,
 * consistent with `f''`), never an empty string — so the caller can always
 * splice the result into `... WHERE <fragment>`. A caller whose policy requires
 * a predicate should check that there are filters before calling.
 *
 * Returns `{error}` when the predicate references a joined field (directly, like
 * `orders.amount`, or transitively via a local dimension that aliases one) —
 * such a reference renders with Malloy's internal join alias, which the caller's
 * `FROM <table> AS <tableAlias>` query has no entry for, so this API is scoped to
 * the source's own columns. Genuine compile failures (an unbound given, a missing
 * field) throw `MalloyCompileError`, which the caller surfaces as a fail-closed
 * error.
 */
export function predicateExprToSQL(
  source: SourceDef,
  filters: FilterCondition[],
  modelGivens: Record<GivenID, Given>,
  resolvedGivens: Map<GivenID, Expr> | undefined,
  tableAlias: string,
  eventStream?: EventStream
): PredicateExpressionResult {
  // The alias is interpolated straight into SQL. For an access-control API the
  // safe contract is a bare SQL identifier; reject anything else so a caller
  // that ever routes untrusted input here can't inject. (`base` and any plain
  // identifier pass.)
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableAlias)) {
    return {
      error:
        `Invalid tableAlias '${tableAlias}': must be a bare SQL identifier ` +
        '([A-Za-z_][A-Za-z0-9_]*).',
    };
  }

  const context = new PredicateQueryStruct(
    source,
    modelGivens,
    resolvedGivens,
    tableAlias,
    eventStream
  );
  const resultSet = new PredicateFieldInstanceResultRoot(
    source.queryTimezone ?? 'UTC'
  );
  const chain = new AndChain();
  for (const filter of filters) {
    // Source `where:` filters are always scalar — the translator rejects
    // aggregates in a source filter at compile time (refined-source.ts), so a
    // non-scalar here means an upstream invariant broke. Fail loud rather than
    // silently dropping a filter, which for an access-control predicate would
    // fail open.
    if (!expressionIsScalar(filter.expressionType)) {
      throw new Error(
        'predicateExprToSQL: source access filter has non-scalar ' +
          `expressionType '${filter.expressionType}'; expected a scalar ` +
          'predicate. This is an internal invariant violation.'
      );
    }
    chain.add(exprToSQL(resultSet, context, filter.e));
  }

  // Reject any predicate that reached a joined field. A reference that leaves the
  // source's base row is the only thing that allocates a join alias, and
  // `getAliasIdentifier` (the sole writer of pathAliasMap) is the only place that
  // happens. So a non-empty pathAliasMap after compilation means the emitted SQL
  // names an alias the caller cannot satisfy. This is the authoritative check: it
  // catches both direct joined refs and local dimensions that alias a joined
  // field, where a syntactic path-length check on the filter would miss the
  // latter. Base-relative columns (including nested record columns) never
  // allocate an alias, so they pass.
  if (context.pathAliasMap.size > 0) {
    const joined = Array.from(context.pathAliasMap.keys())
      .map(p => p.replace(/\.$/, ''))
      .filter(p => p.length > 0)
      .join(', ');
    return {
      error:
        `Access predicate references joined field(s) [${joined}]. ` +
        "accessFilterSQL supports only the source's own columns.",
    };
  }

  // No access filters → no restriction. Emit `true` rather than an empty string
  // so the caller can always splice into `... WHERE <fragment>`.
  return {sql: chain.empty() ? 'true' : chain.sql()};
}
