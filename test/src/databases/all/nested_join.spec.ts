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

    test.when(supported && runtime.dialect.arrayQueries !== undefined)(
      'an array query reads the whole array the on clause unnests',
      async () => {
        // Through the join, `movies.genres` is unnested and the on clause
        // keeps the one genre which matches. An array query reads the
        // array itself, a column of the movie, so it sees both genres.
        await expect(`
        ##! experimental.array_queries
        run: genre_list -> {
          where: genre = 'Emma'
          select:
            movies.state
            matching is movies.genres.each
            genre_count is movies.genres -> { aggregate: n is count() }
          order_by: state
          limit: 2
        }
      `).toEqualResult(tm, [
          {state: 'AL', matching: 'Emma', genre_count: 2},
          {state: 'AR', matching: 'Emma', genre_count: 2},
        ]);
      }
    );

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
  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
