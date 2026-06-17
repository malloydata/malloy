/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {compileQuery} from '../../api/stateless';

// Compile a query for the named dialect with no live connection, returning the
// generated SQL. Used to check stage-combination codegen for dialects we can't
// reach from a dev machine (e.g. Trino).
function sqlFor(dialect: string, query: string): string {
  const result = compileQuery({
    model_url: 'file://test.malloy',
    query_malloy: query,
    compiler_needs: {
      table_schemas: [
        {
          connection_name: 'conn',
          name: 'malloytest.state_facts',
          schema: {
            fields: [
              {
                kind: 'dimension',
                name: 'popular_name',
                type: {kind: 'string_type'},
              },
            ],
          },
        },
      ],
      files: [{url: 'file://test.malloy', contents: ''}],
      connections: [{name: 'conn', dialect}],
    },
  });
  const sql = result.result?.sql;
  if (sql === undefined) {
    throw new Error(
      `compile failed: ${JSON.stringify(result.logs ?? [], null, 2)}`
    );
  }
  return sql;
}

describe('pipelined nest stage combination', () => {
  // Issue #2899: a projection-first multi-stage nest on a dialect without
  // SELECT * REPLACE (Trino) emitted a stage-combination that referenced the
  // query's final column names (`f1`, `m`) instead of the group-set-suffixed
  // names the prior CTE actually produced (`f1__0`, `m__0`), and dropped the
  // `group_set` column the final stage needs. Trino rejected it with
  // "Column 'f1' cannot be resolved".
  const query = `
    run: conn.table('malloytest.state_facts') -> {
      group_by: f1 is substr(popular_name, 1, 1)
      nest: m is { select: popular_name } -> { select: popular_name }
    }
  `;

  test('trino carries forward suffixed names and group_set', () => {
    const sql = sqlFor('trino', query);
    // The pipelined stage selects from __stage0 and must reference the columns
    // __stage0 actually produced: the suffixed names plus group_set...
    expect(sql).toMatch(/SELECT group_set, "f1__0",.*FROM __stage0/s);
    // ...never the bare final names, which don't exist in __stage0.
    expect(sql).not.toMatch(/SELECT "f1", "m"[\s\S]*FROM __stage0/);
  });

  test('duckdb still inlines the pipeline (no separate stage)', () => {
    const sql = sqlFor('duckdb', query);
    expect(sql).toContain('"f1__0"');
  });
});
