/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

/*
 * A join whose on clause names a field nested inside the joined source, such
 * as `join_many: a on fac_type = a.by_fac_type.fac_type`, is written as a
 * subquery which unnests the nested data before the ON reads it.
 * https://github.com/malloydata/malloy/issues/1481
 */
describe.each(runtimes.runtimeList)(
  'join on nested field %s',
  (db, runtime) => {
    const model = `
    // One row per state, with its airports by facility type nested inside.
    source: a is ${db}.table('malloytest.airports') -> {
      group_by: state
      aggregate: airport_count is count()
      nest: by_fac_type is {
        group_by: fac_type
        aggregate: airport_count is count()
      }
    }

    source: fac_types is a -> {
      group_by: by_fac_type.fac_type
      aggregate: by_fac_type.airport_count.sum()
    }

    // States as "movies", each with an array of genres: its most popular
    // name, and 'any'.
    source: movies is ${db}.table('malloytest.state_facts') -> {
      select: state, genres is [popular_name, 'any']
    }

    source: genre_list is ${db}.table('malloytest.state_facts') -> {
      group_by: genre is popular_name
    } extend {
      join_many: movies on genre = movies.genres.each
    }
  `;
    const tm = wrapTestModel(runtime, model);
    const supported = runtime.dialect.supportsComplexFilteredSources;

    test.when(supported)('on a field of a repeated record', async () => {
      await expect(`
      run: fac_types -> {
        extend: {
          join_many: a on fac_type = a.by_fac_type.fac_type
        }
        where: fac_type = 'AIRPORT'
        group_by: a.by_fac_type.fac_type
        aggregate: a.by_fac_type.airport_count.sum()
      }
    `).toMatchResult(tm, {fac_type: 'AIRPORT', airport_count: 13925});
    });

    test.when(supported)(
      'distinct keys of the join and of its unnest',
      async () => {
        // 473 seaplane bases in 41 states, which have 15430 airports in all
        await expect(`
        run: fac_types -> {
          extend: {
            join_many: a on fac_type = a.by_fac_type.fac_type
          }
          where: fac_type = 'SEAPLANE BASE'
          aggregate:
            state_count is a.by_fac_type.count()
            seaplane_count is a.by_fac_type.airport_count.sum()
            state_airport_count is a.airport_count.sum()
        }
      `).toMatchResult(tm, {
          state_count: 41,
          seaplane_count: 473,
          state_airport_count: 15430,
        });
      }
    );

    test.when(supported)('select: through the join', async () => {
      await expect(`
      run: fac_types -> {
        extend: {
          join_many: a on fac_type = a.by_fac_type.fac_type
        }
        where: fac_type = 'SEAPLANE BASE'
        select: fac_type, a.state, seaplane_count is a.by_fac_type.airport_count
        order_by: state
        limit: 2
      }
    `).toEqualResult(tm, [
        {fac_type: 'SEAPLANE BASE', state: 'AK', seaplane_count: 104},
        {fac_type: 'SEAPLANE BASE', state: 'AL', seaplane_count: 3},
      ]);
    });

    test.when(supported)(
      'through a dimension of the joined source',
      async () => {
        await expect(`
      source: a_fac is a extend {
        dimension: nested_fac_type is by_fac_type.fac_type
      }
      run: a_fac -> { group_by: nested_fac_type } extend {
        join_many: a_fac on nested_fac_type = a_fac.nested_fac_type
      } -> {
        where: nested_fac_type = 'AIRPORT'
        group_by: nested_fac_type
        aggregate: airport_count is a_fac.by_fac_type.airport_count.sum()
      }
    `).toMatchResult(tm, {nested_fac_type: 'AIRPORT', airport_count: 13925});
      }
    );

    test.when(supported)('filtered join with a nested field', async () => {
      // 1486 airports in the states in state_facts whose names start with A
      await expect(`
      run: ${db}.table('malloytest.state_facts') extend {
        join_many: a_states is a extend { where: state ~ 'A%' }
          on state = a_states.state
      } -> {
        aggregate: airport_count is a_states.by_fac_type.airport_count.sum()
      }
    `).toMatchResult(tm, {airport_count: 1486});
    });

    test.when(supported)('on an element of an array of scalars', async () => {
      // 24 states' most popular name is Isabella, each with one Isabella genre
      await expect(`
      run: genre_list -> {
        where: genre = 'Isabella'
        group_by: genre
        aggregate:
          movie_count is movies.count()
          genre_count is movies.genres.count()
      }
    `).toEqualResult(tm, [
        {genre: 'Isabella', movie_count: 24, genre_count: 24},
      ]);
    });

    test.when(supported)('select: an array of scalars', async () => {
      await expect(`
      run: genre_list -> {
        where: genre = 'Emma'
        select: genre, movies.state, movies.genres.each
        order_by: state
      }
    `).toEqualResult(tm, [
        {genre: 'Emma', state: 'AL', each: 'Emma'},
        {genre: 'Emma', state: 'AR', each: 'Emma'},
        {genre: 'Emma', state: 'IN', each: 'Emma'},
        {genre: 'Emma', state: 'ME', each: 'Emma'},
        {genre: 'Emma', state: 'MT', each: 'Emma'},
        {genre: 'Emma', state: 'NC', each: 'Emma'},
      ]);
    });

    test.when(supported)(
      'a join on a plain column is not a subquery',
      async () => {
        // The joined source has nested data, but the ON does not reach into it.
        const query = `
      run: ${db}.table('malloytest.state_facts') extend {
        join_many: a on state = a.state
      } -> {
        aggregate: airport_count is a.by_fac_type.airport_count.sum()
      }
    `;
        // A join written as a subquery opens it with `SELECT a_0.*`.
        const sql = await runtime.loadModel(model).loadQuery(query).getSQL();
        expect(sql).not.toMatch(/SELECT a_0\.\*/);
        await expect(query).toMatchResult(tm, {airport_count: 19701});
      }
    );

    /*
     * Predicate pushdown: a `where:` condition is also written inside the
     * join's subquery, so it runs before the unnest. Each test checks the
     * answer, and whether the subquery got a WHERE.
     */
    describe('predicate pushdown', () => {
      // The SQL of the subquery joined as `alias`, which ends at its ON. A
      // source given a distinct key is wrapped in a `(...) AS alias` of its
      // own inside the subquery, with no ON after it.
      async function subquery(query: string, alias: string): Promise<string> {
        const sql = await runtime.loadModel(model).loadQuery(query).getSQL();
        const start = sql.indexOf(`SELECT ${alias}.*`);
        expect(start).toBeGreaterThanOrEqual(0);
        const end = sql
          .slice(start)
          .search(new RegExp(`\\) AS ${alias}\\s+ON`));
        expect(end).toBeGreaterThanOrEqual(0);
        return sql.slice(start, start + end);
      }
      // A pushed condition filters the joined rows before the unnest.
      const pushedDown = /FROM \(SELECT \*[^]*WHERE/;
      const byFacType = (where: string) => `
        run: fac_types -> {
          extend: {
            join_many: a on fac_type = a.by_fac_type.fac_type
          }
          where: ${where}
          aggregate: airport_count is a.by_fac_type.airport_count.sum()
        }
      `;

      test.when(supported)('a condition on the joined row', async () => {
        const query = byFacType("a.state = 'AK'");
        expect(await subquery(query, 'a_0')).toMatch(pushedDown);
        await expect(query).toMatchResult(tm, {airport_count: 608});
      });

      test.when(supported)('a list of values', async () => {
        const query = byFacType("a.state ? 'AK' | 'AL'");
        expect(await subquery(query, 'a_0')).toMatch(pushedDown);
        await expect(query).toMatchResult(tm, {airport_count: 868});
      });

      test.when(supported)('a condition on a nested element', async () => {
        // Only Texas has a facility type with more than 1000 airports.
        const query = byFacType('a.by_fac_type.airport_count > 1000');
        expect(await subquery(query, 'a_0')).toMatch(pushedDown);
        await expect(query).toMatchResult(tm, {airport_count: 1389});
      });

      test.when(supported)('two conditions, each pushed', async () => {
        const query = byFacType(
          "a.state = 'AK' and a.by_fac_type.fac_type = 'SEAPLANE BASE'"
        );
        const sql = await subquery(query, 'a_0');
        expect(sql).toMatch(pushedDown);
        expect(sql).toMatch(/WHERE[^]*'AK'[^]*AND[^]*'SEAPLANE BASE'/);
        await expect(query).toMatchResult(tm, {airport_count: 104});
      });

      test.when(supported)(
        'a condition on the join key, through the ON',
        async () => {
          const query = byFacType("fac_type = 'SEAPLANE BASE'");
          const sql = await subquery(query, 'a_0');
          expect(sql).toMatch(pushedDown);
          expect(sql).toMatch(/'SEAPLANE BASE'/);
          await expect(query).toMatchResult(tm, {airport_count: 473});
        }
      );

      test.when(supported)(
        'a condition on the join key of an array of scalars',
        async () => {
          const query = `
            run: genre_list -> {
              where: genre = 'Emma'
              group_by: genre
              aggregate: movie_count is movies.count()
            }
          `;
          const sql = await subquery(query, 'movies_0');
          expect(sql).toMatch(pushedDown);
          expect(sql).toMatch(/'Emma'/);
          await expect(query).toEqualResult(tm, [
            {genre: 'Emma', movie_count: 6},
          ]);
        }
      );

      // The answer is the same whether or not the copy runs before the
      // unnest, so only the plan shows it: 6 movies are named Emma, so their
      // unnest yields 12 genres, not all 102.
      test.when(db === 'duckdb')(
        'the unnest sees only matching rows',
        async () => {
          const query = `
          run: genre_list -> {
            where: genre = 'Emma'
            group_by: genre
            aggregate: movie_count is movies.count()
          }
        `;
          const sql = await runtime.loadModel(model).loadQuery(query).getSQL();
          const connection = await runtime.connections.lookupConnection(db);
          const plan = await connection.runSQL(
            `EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`
          );
          const unnestRows: number[] = [];
          const walk = (node: {
            operator_name?: string;
            operator_cardinality?: number;
            extra_info?: {Name?: string};
            children?: [];
          }) => {
            if (node.extra_info?.Name === 'unnest') {
              unnestRows.push(Number(node.operator_cardinality));
            }
            for (const child of node.children ?? []) walk(child);
          };
          walk(JSON.parse(String(Object.values(plan.rows[0])[1])));
          expect(unnestRows.length).toBeGreaterThan(0);
          expect(Math.max(...unnestRows)).toBeLessThanOrEqual(12);
        }
      );

      test.when(supported)('!= is not pushed: it matches nulls', async () => {
        const query = byFacType("a.state != 'AK'");
        expect(await subquery(query, 'a_0')).not.toMatch(/WHERE/);
        await expect(query).toMatchResult(tm, {airport_count: 19185});
      });

      test.when(supported)(
        'an OR across both sides is not pushed',
        async () => {
          const query = byFacType("a.state = 'AK' or fac_type = 'HELIPORT'");
          expect(await subquery(query, 'a_0')).not.toMatch(/WHERE/);
          await expect(query).toMatchResult(tm, {airport_count: 5713});
        }
      );
    });
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
