/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Expr, FilterCondition, SourceDef} from '../malloy_types';
import {predicateExprToSQL} from '../predicate_expression_compiler';

// A two-column source. `dialect` is flipped per-test to exercise dialect
// routing without needing a live connection.
function mkSource(dialect: string): SourceDef {
  return {
    type: 'table',
    name: 'rows',
    tablePath: 'rows',
    connection: 'test',
    dialect,
    fields: [
      {type: 'number', name: 'tenant_id'},
      {type: 'boolean', name: 'is_public'},
    ],
  };
}

// tenant_id = 1 or is_public
const COMPOUND: Expr = {
  node: 'or',
  kids: {
    left: {
      node: '=',
      kids: {
        left: {node: 'field', path: ['tenant_id']},
        right: {node: 'numberLiteral', literal: '1'},
      },
    },
    right: {node: 'field', path: ['is_public']},
  },
};

function mkFilter(e: Expr, fieldPaths: string[][]): FilterCondition {
  return {
    node: 'filterCondition',
    code: 'tenant_id = 1 or is_public',
    expressionType: 'scalar',
    isSourceFilter: true,
    e,
    refSummary: {fieldUsage: fieldPaths.map(path => ({path}))},
  };
}

describe('predicateExprToSQL', () => {
  const filter = mkFilter(COMPOUND, [['tenant_id'], ['is_public']]);

  test('compiles a compound predicate for DuckDB', () => {
    const r = predicateExprToSQL(
      mkSource('duckdb'),
      [filter],
      {},
      undefined,
      'base'
    );
    expect(r.error).toBeUndefined();
    expect(r.sql).toContain('base."tenant_id"');
    expect(r.sql).toContain('base."is_public"');
    expect(r.sql?.toLowerCase()).toContain('or');
  });

  test('compiles the same predicate for Postgres (dialect-routed)', () => {
    const r = predicateExprToSQL(
      mkSource('postgres'),
      [filter],
      {},
      undefined,
      'base'
    );
    expect(r.error).toBeUndefined();
    expect(r.sql).toContain('base."tenant_id"');
    expect(r.sql).toContain('base."is_public"');
  });

  test('qualifies columns with a caller-supplied alias', () => {
    const r = predicateExprToSQL(
      mkSource('duckdb'),
      [filter],
      {},
      undefined,
      'idx'
    );
    expect(r.sql).toContain('idx."tenant_id"');
    expect(r.sql).not.toContain('base.');
  });

  test('emits `true` (not empty) when there are no filters', () => {
    const r = predicateExprToSQL(mkSource('duckdb'), [], {}, undefined, 'base');
    expect(r.error).toBeUndefined();
    expect(r.sql).toBe('true');
  });

  test('rejects a tableAlias that is not a bare SQL identifier', () => {
    const r = predicateExprToSQL(
      mkSource('duckdb'),
      [filter],
      {},
      undefined,
      'base; DROP TABLE x'
    );
    expect(r.sql).toBeUndefined();
    expect(r.error).toMatch(/Invalid tableAlias/);
  });
});
