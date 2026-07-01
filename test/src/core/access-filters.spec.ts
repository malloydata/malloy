/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import {Explore} from '@malloydata/malloy';
import type {Expr} from '@malloydata/malloy';

const runtime = runtimeFor('duckdb');

const envDatabases = (
  process.env['MALLOY_DATABASES'] ||
  process.env['MALLOY_DATABASE'] ||
  'duckdb'
).split(',');

let describe = globalThis.describe;
if (!envDatabases.includes('duckdb')) {
  describe = describe.skip;
  describe.skip = describe;
}

afterAll(async () => {
  await runtime.connection.close();
});

// A four-row table: tenants 1,2,3 with one public row (tenant 3).
const ROWS_SQL =
  "SELECT * FROM (VALUES (1, false, 'a'), (1, false, 'b'), " +
  "(2, false, 'c'), (3, true, 'd')) AS t(tenant_id, is_public, label)";

// Compound access predicate: a tenant sees its own rows OR any public row.
const COMPOUND_MODEL = `
  ##! experimental.givens
  given: TENANT :: number
  source: rows is duckdb.sql("""${ROWS_SQL}""") extend {
    where: tenant_id = $TENANT or is_public
  }
`;

/** Collect every field path and given refName referenced anywhere in an Expr. */
function walkRefs(e: Expr): {fields: string[]; givens: string[]} {
  const fields: string[] = [];
  const givens: string[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as {node?: string; path?: string[]; refName?: string};
    if (n.node === 'field' && n.path) fields.push(n.path.join('.'));
    if (n.node === 'given' && n.refName) givens.push(n.refName);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(e);
  return {fields, givens};
}

describe('access predicate inspect + SQL emit (experimental.givens)', () => {
  test('accessFilters exposes the compound predicate as a walkable tree', async () => {
    const explore = await runtime
      .loadModel(COMPOUND_MODEL)
      .getExploreByName('rows');
    const filters = explore.accessFilters;
    expect(filters).toHaveLength(1);

    const filter = filters[0];
    // The source text round-trips.
    expect(filter.code).toContain('tenant_id');
    expect(filter.code).toContain('is_public');
    // The top-level combinator is the `or` — a per-field map could not carry this.
    expect(filter.e.node).toBe('or');
    expect(filter.isSourceFilter).toBe(true);

    // Field + given references are reconstructable, both by walking `.e` and
    // from the pre-computed refSummary.
    const refs = walkRefs(filter.e);
    expect(refs.fields.sort()).toEqual(['is_public', 'tenant_id']);
    expect(refs.givens).toEqual(['TENANT']);

    const summaryFields =
      filter.refSummary?.fieldUsage.map(u => u.path.join('.')).sort() ?? [];
    expect(summaryFields).toEqual(['is_public', 'tenant_id']);
    expect(filter.refSummary?.givenUsage ?? []).toHaveLength(1);
  });

  test('accessFilterSQL emits a WHERE fragment and isolates rows end-to-end', async () => {
    const explore = await runtime
      .loadModel(COMPOUND_MODEL)
      .getExploreByName('rows');
    const where = explore.accessFilterSQL({givens: {TENANT: 1}});

    // Default alias is `base`; columns are qualified and quoted.
    expect(where).toContain('base."tenant_id"');
    expect(where).toContain('base."is_public"');
    expect(where.toLowerCase()).toContain('or');
    expect(where).not.toMatch(/where/i); // bare fragment, no keyword

    // Run the fragment against the same data exposed AS base. Tenant 1 should
    // see its own rows (a, b) plus the public row (d), but not tenant 2's (c).
    const {rows} = await runtime.connection.runSQL(
      `SELECT label FROM (${ROWS_SQL}) AS base WHERE ${where} ORDER BY label`
    );
    expect(rows.map(r => r['label'])).toEqual(['a', 'b', 'd']);
  });

  test('accessFilterSQL honors a caller-supplied table alias', async () => {
    const explore = await runtime
      .loadModel(COMPOUND_MODEL)
      .getExploreByName('rows');
    const where = explore.accessFilterSQL({
      givens: {TENANT: 2},
      tableAlias: 'idx',
    });
    expect(where).toContain('idx."tenant_id"');
    expect(where).not.toContain('base.');

    const {rows} = await runtime.connection.runSQL(
      `SELECT label FROM (${ROWS_SQL}) AS idx WHERE ${where} ORDER BY label`
    );
    // Tenant 2's own row (c) plus the public row (d).
    expect(rows.map(r => r['label'])).toEqual(['c', 'd']);
  });

  test('an unsatisfied given fails closed (throws)', async () => {
    const explore = await runtime
      .loadModel(COMPOUND_MODEL)
      .getExploreByName('rows');
    // No value supplied and no declaration default for TENANT.
    expect(() => explore.accessFilterSQL()).toThrow(/TENANT/);
  });

  test('a source with no access filters emits `true`, not empty string', async () => {
    const explore = await runtime
      .loadModel(
        `
        ##! experimental.givens
        source: rows is duckdb.sql("""${ROWS_SQL}""")
      `
      )
      .getExploreByName('rows');
    expect(explore.accessFilters).toHaveLength(0);
    expect(explore.accessFilterSQL()).toBe('true');
  });

  test('both APIs require the experimental.givens flag', async () => {
    // Same shape, but no `##! experimental.givens` and a constant predicate so
    // the model compiles without the flag.
    const explore = await runtime
      .loadModel(
        `
        source: rows is duckdb.sql("""${ROWS_SQL}""") extend {
          where: tenant_id > 0
        }
      `
      )
      .getExploreByName('rows');
    expect(() => explore.accessFilters).toThrow(/experimental\.givens/);
    expect(() => explore.accessFilterSQL()).toThrow(/experimental\.givens/);
  });

  // A join in the source: a tenant's events are isolated by the joined user's
  // tenant_id. The emitted predicate would reference the `users` join alias,
  // which the caller's `FROM events AS base` query cannot satisfy.
  const USERS_SQL =
    'SELECT * FROM (VALUES (1, 100), (2, 200)) AS t(user_id, tenant_id)';
  const EVENTS_SQL =
    "SELECT * FROM (VALUES (10, 1, 'a'), (11, 2, 'b')) AS t(event_id, user_id, label)";

  test('rejects a direct joined-field reference in the access predicate', async () => {
    const explore = await runtime
      .loadModel(
        `
        ##! experimental.givens
        given: TENANT :: number
        source: users is duckdb.sql("""${USERS_SQL}""")
        source: events is duckdb.sql("""${EVENTS_SQL}""") extend {
          join_one: users on user_id = users.user_id
          where: users.tenant_id = $TENANT
        }
      `
      )
      .getExploreByName('events');
    // Given supplied so binding succeeds and we reach the join-alias check.
    expect(() => explore.accessFilterSQL({givens: {TENANT: 100}})).toThrow(
      /joined field/
    );
  });

  test('rejects a local dimension that aliases a joined field', async () => {
    const explore = await runtime
      .loadModel(
        `
        ##! experimental.givens
        given: TENANT :: number
        source: users is duckdb.sql("""${USERS_SQL}""")
        source: events is duckdb.sql("""${EVENTS_SQL}""") extend {
          join_one: users on user_id = users.user_id
          dimension: my_tenant is users.tenant_id
          where: my_tenant = $TENANT
        }
      `
      )
      .getExploreByName('events');
    // The filter references `my_tenant` (a one-part path), but it expands to the
    // joined `users.tenant_id` — a syntactic path check would miss this.
    expect(() => explore.accessFilterSQL({givens: {TENANT: 100}})).toThrow(
      /joined field/
    );
  });

  test('detached (deserialized) Explore: inspect works, given-bound emit throws clearly', async () => {
    const live = await runtime
      .loadModel(COMPOUND_MODEL)
      .getExploreByName('rows');
    const detached = Explore.fromJSON(live.toJSON());
    // Inspection survives serialization (structure lives on the structDef).
    expect(detached.accessFilters).toHaveLength(1);
    // Binding does not: fromJSON drops the model's given declarations, so this
    // fails with an actionable message rather than a confusing "unknown given".
    expect(() => detached.accessFilterSQL({givens: {TENANT: 1}})).toThrow(
      /does not declare/
    );
  });

  test('uses a given declaration default when no value is supplied', async () => {
    const explore = await runtime
      .loadModel(
        `
        ##! experimental.givens
        given: TENANT :: number is 1
        source: rows is duckdb.sql("""${ROWS_SQL}""") extend {
          where: tenant_id = $TENANT or is_public
        }
      `
      )
      .getExploreByName('rows');
    // No givens supplied → the declaration default (1) binds, same as query
    // execution. Tenant 1's rows (a, b) plus the public row (d).
    const where = explore.accessFilterSQL();
    const {rows} = await runtime.connection.runSQL(
      `SELECT label FROM (${ROWS_SQL}) AS base WHERE ${where} ORDER BY label`
    );
    expect(rows.map(r => r['label'])).toEqual(['a', 'b', 'd']);
  });

  test('ANDs multiple source where: clauses into one fragment', async () => {
    const explore = await runtime
      .loadModel(
        `
        ##! experimental.givens
        given: TENANT :: number
        source: rows is duckdb.sql("""${ROWS_SQL}""") extend {
          where: tenant_id = $TENANT
          where: is_public = false
        }
      `
      )
      .getExploreByName('rows');
    expect(explore.accessFilters).toHaveLength(2);
    const where = explore.accessFilterSQL({givens: {TENANT: 1}});
    expect(where.toUpperCase()).toContain('AND');
    const {rows} = await runtime.connection.runSQL(
      `SELECT label FROM (${ROWS_SQL}) AS base WHERE ${where} ORDER BY label`
    );
    // tenant 1 AND not public → a, b (d is public, c is tenant 2).
    expect(rows.map(r => r['label'])).toEqual(['a', 'b']);
  });

  test('allows base-relative nested record columns (not treated as a join)', async () => {
    // A struct/record column on the base row. Referencing a nested field stays
    // base-relative (`base."acl"...`), so it is emitted, not rejected as a join.
    const RECORD_SQL =
      "SELECT {'tid': 1, 'pub': false} AS acl, 'a' AS label " +
      "UNION ALL SELECT {'tid': 2, 'pub': false}, 'c' " +
      "UNION ALL SELECT {'tid': 3, 'pub': true}, 'd'";
    const explore = await runtime
      .loadModel(
        `
        ##! experimental.givens
        given: TENANT :: number
        source: rows is duckdb.sql("""${RECORD_SQL}""") extend {
          where: acl.tid = $TENANT or acl.pub
        }
      `
      )
      .getExploreByName('rows');
    // Not rejected as a joined field; emits a base-qualified fragment.
    const where = explore.accessFilterSQL({givens: {TENANT: 1}});
    expect(where).toContain('base');
    expect(where).not.toMatch(/joined field/);
  });
});
