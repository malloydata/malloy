/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor} from '../runtimes';
import {wrapTestModel} from '@malloydata/malloy/test';
import {buildInternalGraph} from '@malloydata/malloy/test/internal';

const tstDB = 'duckdb';
const tstRuntime = runtimeFor(tstDB);

const connections = {
  lookupConnection: async () => tstRuntime.connection,
};

// Shared test models
const singlePersistQueryModel = () =>
  wrapTestModel(
    tstRuntime,
    `source: flights is ${tstDB}.table('malloytest.flights')

    #@ persist
    query: carrier_counts is flights -> {
      group_by: carrier
      aggregate: flight_count is count()
    }
  `
  );

const twoLevelDependentQueriesModel = () =>
  wrapTestModel(
    tstRuntime,
    `
    source: flights is ${tstDB}.table('malloytest.flights')

    #@ persist
    query: base_stats is flights -> {
      group_by: carrier
      aggregate: flight_count is count()
    }

    source: stats_source is base_stats

    #@ persist
    query: top_carriers is stats_source -> {
      select: *
    }
  `
  );

afterAll(async () => {
  await tstRuntime.connection.close();
});

describe('persistent query support', () => {
  describe('buildInternalGraph', () => {
    it('returns empty array for empty input', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `source: flights is ${tstDB}.table('malloytest.flights')`
      );

      const model = await testModel.model.getModel();
      const modelDef = model._modelDef;

      const graph = buildInternalGraph([], modelDef);

      expect(graph).toEqual([]);
    });

    it('groups independent queries in same level for parallel execution', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: query_a is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        #@ persist
        query: query_b is flights -> {
          group_by: origin
          aggregate: flight_count is count()
        }

        #@ persist
        query: query_c is flights -> {
          group_by: destination
          aggregate: flight_count is count()
        }
      `
      );

      const model = await testModel.model.getModel();
      const modelDef = model._modelDef;

      const graph = buildInternalGraph(
        ['query_a', 'query_b', 'query_c'],
        modelDef
      );

      // All three should be in the same level since they're independent
      expect(graph).toHaveLength(1);
      expect(graph[0]).toHaveLength(3);
      const names = graph[0].map(n => n.name).sort();
      expect(names).toEqual(['query_a', 'query_b', 'query_c']);
      // All should have no dependencies
      for (const node of graph[0]) {
        expect(node.dependsOn).toEqual([]);
      }
    });

    it('handles diamond dependencies (A->B, A->C, B->D, C->D)', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: query_a is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        source: source_a is query_a

        #@ persist
        query: query_b is source_a -> { select: * }

        #@ persist
        query: query_c is source_a -> { select: * }

        source: source_b is query_b
        source: source_c is query_c

        #@ persist
        query: query_d is source_b -> {
          extend: { join_one: c is source_c on true }
          select: *
        }
      `
      );

      const model = await testModel.model.getModel();
      const modelDef = model._modelDef;

      const graph = buildInternalGraph(
        ['query_a', 'query_b', 'query_c', 'query_d'],
        modelDef
      );

      // Level 0: query_a (no deps)
      // Level 1: query_b, query_c (both depend on query_a)
      // Level 2: query_d (depends on query_b and query_c)
      expect(graph).toHaveLength(3);

      expect(graph[0]).toMatchObject([{name: 'query_a', dependsOn: []}]);

      const level1Names = graph[1].map(n => n.name).sort();
      expect(level1Names).toEqual(['query_b', 'query_c']);
      for (const node of graph[1]) {
        expect(node.dependsOn).toEqual(['query_a']);
      }

      expect(graph[2]).toHaveLength(1);
      expect(graph[2][0].name).toBe('query_d');
      // query_d depends on query_a transitively through both query_b and query_c
      expect(graph[2][0].dependsOn.sort()).toEqual([
        'query_a',
        'query_b',
        'query_c',
      ]);
    });

    it('ignores non-persist query dependencies', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        // This query is NOT marked with persist
        query: intermediate is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        source: intermediate_source is intermediate

        #@ persist
        query: final_query is intermediate_source -> { select: * }
      `
      );

      const model = await testModel.model.getModel();
      const modelDef = model._modelDef;

      // Only pass the persist query, not the intermediate one
      const graph = buildInternalGraph(['final_query'], modelDef);

      // Should have single level with no dependencies (intermediate is not in persist set)
      expect(graph).toMatchObject([[{name: 'final_query', dependsOn: []}]]);
    });

    it('detects dependencies through joined query_source', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        source: carrier_stats_source is carrier_stats

        #@ persist
        query: flights_with_stats is flights -> {
          extend: {
            join_one: stats is carrier_stats_source on carrier = stats.carrier
          }
          select: carrier, origin, stats.flight_count
        }
      `
      );

      const model = await testModel.model.getModel();
      const modelDef = model._modelDef;

      const graph = buildInternalGraph(
        ['carrier_stats', 'flights_with_stats'],
        modelDef
      );

      expect(graph).toMatchObject([
        [{name: 'carrier_stats', dependsOn: []}],
        [{name: 'flights_with_stats', dependsOn: ['carrier_stats']}],
      ]);
    });

    it('detects dependencies through extendSource joins', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: carrier_lookup is flights -> {
          group_by: carrier
          aggregate: total_flights is count()
        }

        source: carrier_lookup_source is carrier_lookup

        source: base_flights is flights

        #@ persist
        query: enriched_flights is base_flights -> {
          extend: {
            join_one: lookup is carrier_lookup_source on carrier = lookup.carrier
          }
          group_by: carrier
          aggregate: flight_count is count()
        }
      `
      );

      const model = await testModel.model.getModel();
      const modelDef = model._modelDef;

      const graph = buildInternalGraph(
        ['carrier_lookup', 'enriched_flights'],
        modelDef
      );

      expect(graph).toMatchObject([
        [{name: 'carrier_lookup', dependsOn: []}],
        [{name: 'enriched_flights', dependsOn: ['carrier_lookup']}],
      ]);
    });

    it('returns single node for query with no persist dependencies', async () => {
      const model = await singlePersistQueryModel().model.getModel();
      const graph = buildInternalGraph(['carrier_counts'], model._modelDef);
      expect(graph).toMatchObject([[{name: 'carrier_counts', dependsOn: []}]]);
    });

    it('returns leveled graph for queries with dependencies', async () => {
      const model = await twoLevelDependentQueriesModel().model.getModel();
      const graph = buildInternalGraph(
        ['base_stats', 'top_carriers'],
        model._modelDef
      );
      expect(graph).toMatchObject([
        [{name: 'base_stats', dependsOn: []}],
        [{name: 'top_carriers', dependsOn: ['base_stats']}],
      ]);
    });
  });

  describe('NamedQuery', () => {
    test.todo('getDigest returns undefined before graph computation');
    test.todo('getDigest returns digest after graph computation');
    test.todo('getPreparedResult returns SQL without manifest');
    test.todo('getPreparedResult substitutes table names with manifest');
    test.todo(
      'getPreparedResult with stale manifest (digest not found) expands query'
    );
    test.todo(
      'getPreparedResult with strict mode throws when digest not in manifest'
    );
  });

  describe('Model named query methods', () => {
    test.todo('getNamedQuery returns NamedQuery for valid name');
    test.todo('getNamedQuery throws for non-existent name');
    test.todo('getNamedQuery throws for source name (not a query)');
    test.todo('getNamedQueries returns all named queries');
    test.todo('getNamedQueries excludes sources');
    test.todo('getPersistQueries filters to only #@ persist queries');
    test.todo('getPersistQueries returns empty array when no persist queries');
  });

  describe('Model.getBuildGraphs', () => {
    it('returns leaves from multiple disjoint dependency chains', async () => {
      // Two independent chains: A→B and C→D
      // Each leaf gets its own graph, preserving file order
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: query_a is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        source: source_a is query_a

        #@ persist
        query: query_b is source_a -> { select: * }

        #@ persist
        query: query_c is flights -> {
          group_by: origin
          aggregate: flight_count is count()
        }

        source: source_c is query_c

        #@ persist
        query: query_d is source_c -> { select: * }
      `
      );

      const model = await testModel.model.getModel();
      const graphs = await model.getBuildGraphs(connections);

      // Two graphs, one per leaf (preserving file order)
      expect(graphs).toHaveLength(2);

      // Each graph has connectionName and nodes
      expect(graphs[0].connectionName).toBe('duckdb');
      expect(graphs[1].connectionName).toBe('duckdb');

      // First graph: query_b
      expect(graphs[0].nodes[0][0].id.name).toBe('query_b');
      expect(graphs[0].nodes[0][0].dependsOn.map(d => d.name)).toEqual([
        'query_a',
      ]);

      // Second graph: query_d
      expect(graphs[1].nodes[0][0].id.name).toBe('query_d');
      expect(graphs[1].nodes[0][0].dependsOn.map(d => d.name)).toEqual([
        'query_c',
      ]);
    });

    it('returns minimal build set (only leaf queries, not intermediate dependencies)', async () => {
      // A -> B -> C chain: only C should be in the minimal build set
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: query_a is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        source: source_a is query_a

        #@ persist
        query: query_b is source_a -> { select: * }

        source: source_b is query_b

        #@ persist
        query: query_c is source_b -> { select: * }
      `
      );

      const model = await testModel.model.getModel();
      const graphs = await model.getBuildGraphs(connections);

      // Should have one graph with only query_c (the leaf)
      // query_a and query_b are dependencies, not targets
      expect(graphs).toHaveLength(1);
      const graph = graphs[0];

      expect(graph.connectionName).toBe('duckdb');
      // Minimal build set: only the leaf node
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]).toHaveLength(1);
      expect(graph.nodes[0][0].id.name).toBe('query_c');
      // query_c depends on query_a and query_b (transitively)
      const depNames = graph.nodes[0][0].dependsOn.map(d => d.name).sort();
      expect(depNames).toEqual(['query_a', 'query_b']);
    });

    it('digest changes when connection changes', async () => {
      const model = await singlePersistQueryModel().model.getModel();

      // Get digest with original connection
      const graphs1 = await model.getBuildGraphs(connections);
      const digest1 = graphs1[0].nodes[0][0].id.queryDigest;

      // Mock getDigest to return a different value
      const spy = jest
        .spyOn(tstRuntime.connection, 'getDigest')
        .mockReturnValue('different-connection-digest');

      try {
        // Get digest with mocked connection - need fresh model to recompute
        const model2 = await singlePersistQueryModel().model.getModel();
        const graphs2 = await model2.getBuildGraphs(connections);
        const digest2 = graphs2[0].nodes[0][0].id.queryDigest;

        expect(digest1).not.toBe(digest2);
      } finally {
        spy.mockRestore();
      }
    });

    it('returns empty array when no persist queries', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        query: not_persisted is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `
      );
      const model = await testModel.model.getModel();
      const graphs = await model.getBuildGraphs(connections);

      expect(graphs).toEqual([]);
    });

    it('digest changes when SQL changes', async () => {
      const model1 = await wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: my_query is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `
      ).model.getModel();

      const model2 = await wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        query: my_query is flights -> {
          group_by: origin
          aggregate: flight_count is count()
        }
      `
      ).model.getModel();

      const graphs1 = await model1.getBuildGraphs(connections);
      const graphs2 = await model2.getBuildGraphs(connections);

      const digest1 = graphs1[0].nodes[0][0].id.queryDigest;
      const digest2 = graphs2[0].nodes[0][0].id.queryDigest;

      expect(digest1).not.toBe(digest2);
    });

    it('returns build graph with digests for persist query', async () => {
      const model = await singlePersistQueryModel().model.getModel();
      const graphs = await model.getBuildGraphs(connections);

      expect(graphs).toHaveLength(1);
      expect(graphs[0]).toMatchObject({
        connectionName: 'duckdb',
        nodes: [
          [
            {
              id: {name: 'carrier_counts', queryDigest: expect.any(String)},
              dependsOn: [],
            },
          ],
        ],
      });
    });

    it('returns only leaf node with dependencies for dependent queries', async () => {
      const model = await twoLevelDependentQueriesModel().model.getModel();
      const graphs = await model.getBuildGraphs(connections);

      expect(graphs).toHaveLength(1);
      const graph = graphs[0];

      expect(graph.connectionName).toBe('duckdb');
      // Minimal build set: only top_carriers (the leaf), not base_stats
      expect(graph.nodes).toMatchObject([
        [
          {
            id: {name: 'top_carriers', queryDigest: expect.any(String)},
            dependsOn: [{name: 'base_stats', queryDigest: expect.any(String)}],
          },
        ],
      ]);
    });
  });
});
