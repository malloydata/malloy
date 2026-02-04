/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {runtimeFor, testFileSpace, DuckDBROTestConnection} from '../runtimes';
import {wrapTestModel} from '@malloydata/malloy/test';
import type {BuildNode, BuildManifest} from '@malloydata/malloy';
import {ConnectionRuntime} from '@malloydata/malloy';

// Helper to extract all sourceIDs from a nested BuildNode array (recursive)
function getAllSourceIDs(nodes: BuildNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.sourceID);
    ids.push(...getAllSourceIDs(node.dependsOn));
  }
  return ids;
}

// Helper to check if a sourceID pattern exists anywhere in nested deps
function hasDependency(nodes: BuildNode[], pattern: string): boolean {
  return getAllSourceIDs(nodes).some(id => id.includes(pattern));
}

const tstDB = 'duckdb';
const tstRuntime = runtimeFor(tstDB);

// All persist tests require the experimental.persistence annotation
const PERSIST_ANNOTATION = '## experimental.persistence';

// Combine model + plan setup
async function getPersistPlan(malloyCode: string) {
  const testModel = wrapTestModel(
    tstRuntime,
    `${PERSIST_ANNOTATION}\n${malloyCode}`
  );
  const model = await testModel.model.getModel();
  return {model, plan: model.getBuildPlan()};
}

// Find node by pattern in graph nodes
function findNode(nodes: BuildNode[][], pattern: string) {
  return nodes.flat().find(n => n.sourceID.includes(pattern))!;
}

// Create empty manifest
function createManifest(): BuildManifest {
  return {
    modelUrl: 'test://test.malloy',
    buildStartedAt: new Date().toISOString(),
    buildFinishedAt: new Date().toISOString(),
    buildEntries: {},
  };
}

// Add entry to manifest
function addManifestEntry(
  manifest: BuildManifest,
  buildId: string,
  tableName: string
) {
  manifest.buildEntries[buildId] = {
    buildId,
    tableName,
    buildStartedAt: new Date().toISOString(),
    buildFinishedAt: new Date().toISOString(),
  };
}

// Connection digest (cached)
let cachedDigest: string | undefined;
async function getDigest() {
  if (!cachedDigest) {
    const conn = await tstRuntime.connections.lookupConnection(tstDB);
    cachedDigest = await conn.getDigest();
  }
  return cachedDigest;
}

afterAll(async () => {
  await tstRuntime.connection.close();
});

describe('source persistence', () => {
  describe('PersistSource', () => {
    describe('makeBuildId', () => {
      it('different sourceID produce different buildIds', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is flights -> {
            group_by: origin
            aggregate: flight_count is count()
          }
        `);

        const sourceA = Object.values(plan.sources).find(s =>
          s.sourceID.includes('source_a')
        )!;
        const sourceB = Object.values(plan.sources).find(s =>
          s.sourceID.includes('source_b')
        )!;

        const sqlA = sourceA.getSQL();
        const sqlB = sourceB.getSQL();
        const digest = 'test-digest';

        const buildIdA = sourceA.makeBuildId(digest, sqlA);
        const buildIdB = sourceB.makeBuildId(digest, sqlB);

        // Different SQL produces different buildIds (buildId is a hash)
        expect(buildIdA).not.toBe(buildIdB);
        // BuildId is a hash, not a formatted string
        expect(buildIdA).toMatch(/^[a-f0-9]{32}$/);
        expect(buildIdB).toMatch(/^[a-f0-9]{32}$/);
      });

      it('different connection digests produce different buildIds', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }
        `);

        const source = Object.values(plan.sources)[0];
        const sql = source.getSQL();

        const buildId1 = source.makeBuildId('digest-user1', sql);
        const buildId2 = source.makeBuildId('digest-user2', sql);

        // Different connection digests produce different buildIds
        expect(buildId1).not.toBe(buildId2);
        // BuildId is a hash
        expect(buildId1).toMatch(/^[a-f0-9]{32}$/);
        expect(buildId2).toMatch(/^[a-f0-9]{32}$/);
      });

      it('different SQL produces different buildIds', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }
        `);

        const source = Object.values(plan.sources)[0];
        const digest = 'test-digest';

        const buildId1 = source.makeBuildId(digest, 'SELECT 1');
        const buildId2 = source.makeBuildId(digest, 'SELECT 2');

        // Different SQL produces different buildIds
        expect(buildId1).not.toBe(buildId2);
        // BuildId is a hash
        expect(buildId1).toMatch(/^[a-f0-9]{32}$/);
        expect(buildId2).toMatch(/^[a-f0-9]{32}$/);
      });
    });

    describe('getSQL', () => {
      it('returns SQL for query_source', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }
        `);

        const source = Object.values(plan.sources)[0];
        const sql = source.getSQL();

        expect(sql).toContain('SELECT');
        expect(sql).toContain('carrier');
        expect(sql).toContain('COUNT(');
      });

      it('returns SQL for sql_select', async () => {
        const {plan} = await getPersistPlan(`
          #@ persist
          source: custom_sql is ${tstDB}.sql("""
            SELECT carrier, COUNT(*) as flight_count
            FROM malloytest.flights
            GROUP BY carrier
          """)
        `);

        const source = Object.values(plan.sources)[0];
        const sql = source.getSQL();

        expect(sql).toContain('SELECT');
        expect(sql).toContain('carrier');
        expect(sql).toContain('COUNT(*)');
      });

      it('substitutes manifest tables when buildManifest provided', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: wrapper is ${tstDB}.sql("""
            SELECT * FROM %{ carrier_stats }
          """)
        `);

        const connectionDigest = await getDigest();

        // Get carrier_stats source and compute its buildId
        const carrierStats = Object.values(plan.sources).find(
          s => s.name === 'carrier_stats'
        )!;
        const carrierStatsSQL = carrierStats.getSQL();
        const carrierStatsBuildId = carrierStats.makeBuildId(
          connectionDigest,
          carrierStatsSQL
        );

        // Create a manifest with the carrier_stats entry
        const manifest = createManifest();
        addManifestEntry(
          manifest,
          carrierStatsBuildId,
          'my_schema.persisted_carrier_stats'
        );

        // Get wrapper source and call getSQL with manifest
        const wrapper = Object.values(plan.sources).find(
          s => s.name === 'wrapper'
        )!;
        const sql = wrapper.getSQL({
          buildManifest: manifest,
          connectionDigests: {[tstDB]: connectionDigest},
        });

        // The SQL should reference the persisted table, not expand inline
        expect(sql).toContain('my_schema.persisted_carrier_stats');
        // Should NOT contain the full expanded query
        expect(sql).not.toContain('COUNT(');
      });

      it('expands SQL when manifest entry not found', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: wrapper is ${tstDB}.sql("""
            SELECT * FROM %{ carrier_stats }
          """)
        `);

        const connectionDigest = await getDigest();
        const manifest = createManifest();

        // Get wrapper source and call getSQL with empty manifest
        const wrapper = Object.values(plan.sources).find(
          s => s.name === 'wrapper'
        )!;
        const sql = wrapper.getSQL({
          buildManifest: manifest,
          connectionDigests: {[tstDB]: connectionDigest},
        });

        // Should expand inline since not in manifest
        expect(sql).toContain('SELECT');
        expect(sql).toContain('carrier');
        expect(sql).toContain('COUNT(');
      });

      it('throws in strict mode when manifest entry not found', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: wrapper is ${tstDB}.sql("""
            SELECT * FROM %{ carrier_stats }
          """)
        `);

        const connectionDigest = await getDigest();
        const manifest = createManifest();

        const wrapper = Object.values(plan.sources).find(
          s => s.name === 'wrapper'
        )!;

        // Should throw in strict mode
        expect(() =>
          wrapper.getSQL({
            buildManifest: manifest,
            connectionDigests: {[tstDB]: connectionDigest},
            strictPersist: true,
          })
        ).toThrow(/not found in manifest/);
      });

      it('query_source substitutes manifest tables for its structRef', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: derived is carrier_stats -> { select: * }
        `);

        const connectionDigest = await getDigest();

        const carrierStats = Object.values(plan.sources).find(
          s => s.name === 'carrier_stats'
        )!;
        const carrierStatsSQL = carrierStats.getSQL();
        const carrierStatsBuildId = carrierStats.makeBuildId(
          connectionDigest,
          carrierStatsSQL
        );

        const manifest = createManifest();
        addManifestEntry(
          manifest,
          carrierStatsBuildId,
          'cached.carrier_stats_table'
        );

        const derived = Object.values(plan.sources).find(
          s => s.name === 'derived'
        )!;
        const sql = derived.getSQL({
          buildManifest: manifest,
          connectionDigests: {[tstDB]: connectionDigest},
        });

        expect(sql).toContain('cached.carrier_stats_table');
        expect(sql).not.toContain('COUNT(');
      });
    });
  });

  describe('Model.getBuildPlan', () => {
    it('returns empty plan when no persist sources', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        source: not_persisted is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `);

      expect(plan.graphs).toEqual([]);
      expect(plan.sources).toEqual({});
    });

    it('returns single source with no dependencies', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `);

      expect(plan.graphs).toHaveLength(1);
      expect(plan.graphs[0].connectionName).toBe('duckdb');
      expect(plan.graphs[0].nodes).toHaveLength(1);
      expect(plan.graphs[0].nodes[0]).toHaveLength(1);
      expect(plan.graphs[0].nodes[0][0].dependsOn).toEqual([]);

      expect(Object.keys(plan.sources)).toHaveLength(1);
    });

    describe('dependency ordering', () => {
      it('independent sources in same level', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: by_carrier is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: by_origin is flights -> {
            group_by: origin
            aggregate: flight_count is count()
          }
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0]).toHaveLength(2);

        for (const node of graph.nodes[0]) {
          expect(node.dependsOn).toEqual([]);
        }
      });

      it('dependent sources in different levels', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a -> { select: * }
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0]).toHaveLength(1);

        const node = graph.nodes[0][0];
        expect(node.sourceID).toMatch(/source_b/);
        expect(node.dependsOn).toHaveLength(1);
        expect(node.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('diamond dependency pattern with extended sources', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a extend {
            dimension: b_marker is 'b'
          } -> { select: * }

          #@ persist
          source: source_c is source_a extend {
            dimension: c_marker is 'c'
          } -> { select: * }

          #@ persist
          source: source_d is ${tstDB}.sql("""SELECT * FROM %{ source_b } UNION ALL SELECT * FROM %{ source_c }""")
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0]).toHaveLength(1);

        const nodeD = graph.nodes[0][0];
        expect(nodeD.sourceID).toMatch(/source_d/);

        const allDeps = getAllSourceIDs(nodeD.dependsOn);
        expect(allDeps).toHaveLength(3);
        expect(hasDependency(nodeD.dependsOn, 'source_a')).toBe(true);
        expect(hasDependency(nodeD.dependsOn, 'source_b')).toBe(true);
        expect(hasDependency(nodeD.dependsOn, 'source_c')).toBe(true);
      });

      it('diamond dependency pattern with query_source chains', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a -> { select: * }

          #@ persist
          source: source_c is source_a -> { select: * }

          #@ persist
          source: source_d is ${tstDB}.sql("""SELECT * FROM %{ source_b } UNION ALL SELECT * FROM %{ source_c }""")
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0]).toHaveLength(1);

        const nodeD = graph.nodes[0][0];
        expect(nodeD.sourceID).toMatch(/source_d/);

        const allDeps = getAllSourceIDs(nodeD.dependsOn);
        expect(allDeps).toHaveLength(3);
        expect(hasDependency(nodeD.dependsOn, 'source_a')).toBe(true);
        expect(hasDependency(nodeD.dependsOn, 'source_b')).toBe(true);
        expect(hasDependency(nodeD.dependsOn, 'source_c')).toBe(true);
      });
    });

    describe('dependency detection', () => {
      it('query_source: detects dependency on structRef source', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a -> { select: * }
        `);

        const nodeB = findNode(plan.graphs[0].nodes, 'source_b');
        expect(nodeB.dependsOn).toHaveLength(1);
        expect(nodeB.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('query_source: detects dependency through source extend', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a extend {
            dimension: extra_field is 'test'
          } -> { select: * }
        `);

        const nodeB = findNode(plan.graphs[0].nodes, 'source_b');
        expect(nodeB.dependsOn).toHaveLength(1);
        expect(nodeB.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('query_source: detects dependency through chained extends', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a extend {
            dimension: b_field is 'b'
          } -> { select: * }

          #@ persist
          source: source_c is source_b extend {
            dimension: c_field is 'c'
          } -> { select: * }
        `);

        expect(plan.graphs[0].nodes).toHaveLength(1);
        expect(plan.graphs[0].nodes[0]).toHaveLength(1);

        const nodeC = plan.graphs[0].nodes[0][0];
        expect(nodeC.sourceID).toMatch(/source_c/);

        const allDeps = getAllSourceIDs(nodeC.dependsOn);
        expect(allDeps).toHaveLength(2);
        expect(hasDependency(nodeC.dependsOn, 'source_a')).toBe(true);
        expect(hasDependency(nodeC.dependsOn, 'source_b')).toBe(true);
      });

      it('sql_select: detects dependency on interpolated persist source', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is ${tstDB}.sql("""SELECT * FROM %{ source_a }""")
        `);

        expect(plan.graphs[0].nodes[0]).toHaveLength(1);

        const nodeB = plan.graphs[0].nodes[0][0];
        expect(nodeB.sourceID).toMatch(/source_b/);
        expect(nodeB.dependsOn).toHaveLength(1);
        expect(nodeB.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('sql_select: detects dependency on query in interpolation', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is ${tstDB}.sql("""
            SELECT * FROM %{ source_a -> { select: * } }
          """)
        `);

        expect(plan.graphs[0].nodes[0]).toHaveLength(1);

        const nodeB = plan.graphs[0].nodes[0][0];
        expect(nodeB.sourceID).toMatch(/source_b/);
        expect(nodeB.dependsOn).toHaveLength(1);
        expect(nodeB.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('sql_select: detects transitive dependency through non-persistent interpolated source', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          source: source_b is source_a -> { select: * }

          #@ persist
          source: source_c is ${tstDB}.sql("""SELECT * FROM %{ source_b }""")
        `);

        expect(plan.graphs).toHaveLength(1);
        expect(plan.graphs[0].nodes).toHaveLength(1);
        expect(plan.graphs[0].nodes[0]).toHaveLength(1);

        const node = plan.graphs[0].nodes[0][0];
        expect(node.sourceID).toMatch(/source_c/);
        expect(node.dependsOn).toHaveLength(1);
        expect(node.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('detects transitive dependency through non-persistent intermediate source', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          source: source_b is source_a -> { select: * }

          #@ persist
          source: source_c is source_b -> { select: * }
        `);

        expect(plan.graphs).toHaveLength(1);
        expect(plan.graphs[0].nodes).toHaveLength(1);
        expect(plan.graphs[0].nodes[0]).toHaveLength(1);

        const node = plan.graphs[0].nodes[0][0];
        expect(node.sourceID).toMatch(/source_c/);
        expect(node.dependsOn).toHaveLength(1);
        expect(node.dependsOn[0].sourceID).toMatch(/source_a/);
      });

      it('does NOT detect dependencies in source fields array (only extends)', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is flights -> {
            group_by: origin
            aggregate: flight_count is count()
          }
        `);

        expect(plan.graphs[0].nodes[0]).toHaveLength(2);

        const nodeA = findNode(plan.graphs[0].nodes, 'source_a');
        const nodeB = findNode(plan.graphs[0].nodes, 'source_b');

        expect(nodeA.dependsOn).toEqual([]);
        expect(nodeB.dependsOn).toEqual([]);
      });

      it('non-persistent source joining persistent source shows dependency', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')
          source: carriers is ${tstDB}.table('malloytest.carriers')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          source: carriers_with_stats is carriers extend {
            join_one: stats is carrier_stats on stats.carrier = code
          }
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];
        expect(
          graph.nodes[0].some(n => n.sourceID.includes('carrier_stats'))
        ).toBe(true);
      });

      it('query with join in extend block detects persistent dependency', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')
          source: carriers is ${tstDB}.table('malloytest.carriers')

          #@ persist
          source: carrier_stats is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          query: carriers_query is carriers -> {
            extend: {
              join_one: stats is carrier_stats on stats.carrier = code
            }
            select: *
          }
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];
        expect(
          graph.nodes[0].some(n => n.sourceID.includes('carrier_stats'))
        ).toBe(true);
      });
    });

    describe('minimal build set', () => {
      it('returns only leaf sources, not intermediate dependencies', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a -> { select: * }

          #@ persist
          source: source_c is source_b -> { select: * }
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0]).toHaveLength(1);

        const node = graph.nodes[0][0];
        expect(node.sourceID).toMatch(/^source_c@/);

        const allDeps = getAllSourceIDs(node.dependsOn);
        expect(allDeps).toHaveLength(2);
        expect(hasDependency(node.dependsOn, 'source_a')).toBe(true);
        expect(hasDependency(node.dependsOn, 'source_b')).toBe(true);
      });

      it('returns leaves from multiple disjoint chains', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: source_a is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_b is source_a -> { select: * }

          #@ persist
          source: source_c is flights -> {
            group_by: origin
            aggregate: flight_count is count()
          }

          #@ persist
          source: source_d is source_c -> { select: * }
        `);

        expect(plan.graphs).toHaveLength(1);
        const graph = plan.graphs[0];

        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0]).toHaveLength(2);

        const nodeIds = graph.nodes[0].map(n => n.sourceID);
        expect(nodeIds.some(id => id.includes('source_b'))).toBe(true);
        expect(nodeIds.some(id => id.includes('source_d'))).toBe(true);

        const nodeB = findNode(graph.nodes, 'source_b');
        const nodeD = findNode(graph.nodes, 'source_d');

        expect(nodeB.dependsOn).toHaveLength(1);
        expect(nodeB.dependsOn[0].sourceID).toMatch(/source_a/);

        expect(nodeD.dependsOn).toHaveLength(1);
        expect(nodeD.dependsOn[0].sourceID).toMatch(/source_c/);
      });
    });

    describe('connection grouping', () => {
      // Create a second duckdb connection for multi-connection tests
      const duckdb2Conn = new DuckDBROTestConnection(
        'duckdb2',
        'test/data/duckdb/duckdb_test.db'
      );

      afterAll(async () => {
        await duckdb2Conn.close();
      });

      it('groups sources by connection', async () => {
        // Create a model with persist sources on two different connections
        testFileSpace.setFile(
          new URL('test://multi-conn.malloy'),
          `${PERSIST_ANNOTATION}
          source: flights1 is duckdb.table('malloytest.flights')
          source: flights2 is duckdb2.table('malloytest.flights')

          #@ persist
          source: stats1 is flights1 -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: stats2 is flights2 -> {
            group_by: origin
            aggregate: flight_count is count()
          }
          `
        );

        // Use a runtime that has both connections
        const multiRuntime = new ConnectionRuntime({
          urlReader: testFileSpace,
          connections: [tstRuntime.connection, duckdb2Conn],
        });

        const model = await multiRuntime
          .loadModel(new URL('test://multi-conn.malloy'))
          .getModel();
        const plan = model.getBuildPlan();

        // Should have two separate graphs, one for each connection
        expect(plan.graphs).toHaveLength(2);

        // Each graph should have one source
        const connNames = plan.graphs.map(g => g.connectionName).sort();
        expect(connNames).toEqual(['duckdb', 'duckdb2']);

        // Clean up
        testFileSpace.deleteFile(new URL('test://multi-conn.malloy'));
      });

      it('returns separate graphs for different connections', async () => {
        // More detailed test: verify graph structure with dependencies
        testFileSpace.setFile(
          new URL('test://multi-conn2.malloy'),
          `${PERSIST_ANNOTATION}
          source: flights1 is duckdb.table('malloytest.flights')
          source: flights2 is duckdb2.table('malloytest.flights')

          #@ persist
          source: base1 is flights1 -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          #@ persist
          source: derived1 is base1 -> { select: * }

          #@ persist
          source: base2 is flights2 -> {
            group_by: origin
            aggregate: flight_count is count()
          }
          `
        );

        const multiRuntime = new ConnectionRuntime({
          urlReader: testFileSpace,
          connections: [tstRuntime.connection, duckdb2Conn],
        });

        const model = await multiRuntime
          .loadModel(new URL('test://multi-conn2.malloy'))
          .getModel();
        const plan = model.getBuildPlan();

        // Should have two separate graphs
        expect(plan.graphs).toHaveLength(2);

        // Find each graph by connection
        const graph1 = plan.graphs.find(g => g.connectionName === 'duckdb')!;
        const graph2 = plan.graphs.find(g => g.connectionName === 'duckdb2')!;

        expect(graph1).toBeDefined();
        expect(graph2).toBeDefined();

        // duckdb graph: derived1 is leaf, depends on base1
        expect(graph1.nodes).toHaveLength(1);
        expect(graph1.nodes[0]).toHaveLength(1);
        expect(graph1.nodes[0][0].sourceID).toContain('derived1');
        expect(graph1.nodes[0][0].dependsOn).toHaveLength(1);
        expect(graph1.nodes[0][0].dependsOn[0].sourceID).toContain('base1');

        // duckdb2 graph: base2 is leaf with no dependencies
        expect(graph2.nodes).toHaveLength(1);
        expect(graph2.nodes[0]).toHaveLength(1);
        expect(graph2.nodes[0][0].sourceID).toContain('base2');
        expect(graph2.nodes[0][0].dependsOn).toHaveLength(0);

        // Clean up
        testFileSpace.deleteFile(new URL('test://multi-conn2.malloy'));
      });
    });

    describe('persist annotation filtering', () => {
      it('only includes sources with #@ persist', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          #@ persist
          source: persisted is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          source: not_persisted is flights -> {
            group_by: origin
            aggregate: flight_count is count()
          }
        `);

        expect(Object.keys(plan.sources)).toHaveLength(1);
        expect(Object.values(plan.sources)[0].name).toBe('persisted');
      });

      it('ignores sources without persist annotation', async () => {
        const {plan} = await getPersistPlan(`
          source: flights is ${tstDB}.table('malloytest.flights')

          # Some other annotation
          source: annotated_not_persist is flights -> {
            group_by: carrier
            aggregate: flight_count is count()
          }

          source: no_annotation is flights -> {
            group_by: origin
            aggregate: flight_count is count()
          }
        `);

        expect(plan.graphs).toEqual([]);
        expect(plan.sources).toEqual({});
      });

      it('ignores non-persistable source types (table)', async () => {
        const {plan} = await getPersistPlan(`
          #@ persist
          source: flights is ${tstDB}.table('malloytest.flights')
        `);

        expect(plan.graphs).toEqual([]);
        expect(plan.sources).toEqual({});
      });
    });
  });

  describe('sql_select persistence', () => {
    it('sql_select source can be persisted', async () => {
      const {plan} = await getPersistPlan(`
        #@ persist
        source: custom_query is ${tstDB}.sql("""
          SELECT carrier, COUNT(*) as cnt
          FROM malloytest.flights
          GROUP BY carrier
        """)
      `);

      expect(Object.keys(plan.sources)).toHaveLength(1);
      const source = Object.values(plan.sources)[0];
      expect(source.name).toBe('custom_query');
      expect(source.sourceID).toMatch(/custom_query@/);
    });

    it('sql_select with interpolated persist source has dependency', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        #@ persist
        source: combined is ${tstDB}.sql("""
          SELECT * FROM %{ carrier_stats }
          WHERE flight_count > 100
        """)
      `);

      expect(plan.graphs[0].nodes[0]).toHaveLength(1);

      const node = plan.graphs[0].nodes[0][0];
      expect(node.sourceID).toMatch(/combined/);
      expect(node.dependsOn).toHaveLength(1);
      expect(node.dependsOn[0].sourceID).toMatch(/carrier_stats/);
    });

    it('getSQL expands interpolated sources to subqueries', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        #@ persist
        source: wrapper is ${tstDB}.sql("""
          SELECT * FROM %{ carrier_stats }
        """)
      `);

      const wrapperSource = Object.values(plan.sources).find(
        s => s.name === 'wrapper'
      )!;

      const sql = wrapperSource.getSQL();

      expect(sql).toContain('SELECT');
      expect(sql).toContain('carrier');
    });

    it('getSQL substitutes from manifest', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        #@ persist
        source: wrapper is ${tstDB}.sql("""
          SELECT * FROM %{ carrier_stats }
        """)
      `);

      const connectionDigest = await getDigest();

      const carrierStats = Object.values(plan.sources).find(
        s => s.name === 'carrier_stats'
      )!;
      const carrierStatsSQL = carrierStats.getSQL();
      const carrierStatsBuildId = carrierStats.makeBuildId(
        connectionDigest,
        carrierStatsSQL
      );

      const manifest = createManifest();
      addManifestEntry(
        manifest,
        carrierStatsBuildId,
        'cache.carrier_stats_built'
      );

      const wrapper = Object.values(plan.sources).find(
        s => s.name === 'wrapper'
      )!;
      const sql = wrapper.getSQL({
        buildManifest: manifest,
        connectionDigests: {[tstDB]: connectionDigest},
      });

      expect(sql).toContain('cache.carrier_stats_built');
      expect(sql).not.toContain('COUNT(');
    });
  });

  describe('build workflow integration', () => {
    it('full build workflow: getBuildPlan -> getSQL -> makeBuildId', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `);

      expect(plan.graphs).toHaveLength(1);
      expect(Object.keys(plan.sources)).toHaveLength(1);

      const source = Object.values(plan.sources)[0];
      const sql = source.getSQL();
      expect(sql).toContain('SELECT');
      expect(sql).toContain('carrier');

      const mockConnectionDigest = 'mock-connection-digest';
      const buildId = source.makeBuildId(mockConnectionDigest, sql);

      expect(buildId).toMatch(/^[a-f0-9]{32}$/);

      const buildId2 = source.makeBuildId(mockConnectionDigest, sql);
      expect(buildId).toBe(buildId2);

      const parsed = source.tagParse({prefix: /^#@ /});
      expect(parsed.tag.has('persist')).toBe(true);
    });

    it('manifest round-trip: build then query with manifest', async () => {
      const {plan} = await getPersistPlan(`
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }

        #@ persist
        source: wrapper is ${tstDB}.sql("""
          SELECT * FROM %{ carrier_stats } WHERE flight_count > 100
        """)
      `);

      const connectionDigest = await getDigest();
      const manifest = createManifest();

      const carrierStats = Object.values(plan.sources).find(
        s => s.name === 'carrier_stats'
      )!;
      const carrierStatsSQL = carrierStats.getSQL();
      const carrierStatsBuildId = carrierStats.makeBuildId(
        connectionDigest,
        carrierStatsSQL
      );
      addManifestEntry(
        manifest,
        carrierStatsBuildId,
        'build_cache.carrier_stats_v1'
      );

      const wrapper = Object.values(plan.sources).find(
        s => s.name === 'wrapper'
      )!;
      const wrapperSQL = wrapper.getSQL({
        buildManifest: manifest,
        connectionDigests: {[tstDB]: connectionDigest},
      });

      expect(wrapperSQL).toContain('build_cache.carrier_stats_v1');
      expect(wrapperSQL).toContain('flight_count > 100');

      const wrapperBuildId = wrapper.makeBuildId(connectionDigest, wrapperSQL);
      addManifestEntry(manifest, wrapperBuildId, 'build_cache.wrapper_v1');

      expect(Object.keys(manifest.buildEntries)).toHaveLength(2);
      expect(carrierStatsBuildId).not.toBe(wrapperBuildId);
    });
  });

  describe('cross-model imports', () => {
    afterEach(() => {
      // Clean up test files
      testFileSpace.deleteFile(new URL('test://model1.malloy'));
      testFileSpace.deleteFile(new URL('test://model2.malloy'));
      testFileSpace.deleteFile(new URL('test://model3.malloy'));
    });

    it('detects dependency on imported persist source through extend', async () => {
      // Model 1: defines a persist source
      const model1 = `${PERSIST_ANNOTATION}
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: base_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `;

      // Model 2: imports model1 and extends the persist source
      const model2 = `${PERSIST_ANNOTATION}
        import "test://model1.malloy"

        #@ persist
        source: extended_stats is base_stats extend {
          dimension: extra_field is 'test'
        } -> { select: * }
      `;

      testFileSpace.setFile(new URL('test://model1.malloy'), model1);
      testFileSpace.setFile(new URL('test://model2.malloy'), model2);

      const testModel = {
        model: tstRuntime.loadModel(new URL('test://model2.malloy')),
        dialect: tstRuntime.dialect,
      };
      const model = await testModel.model.getModel();
      const plan = model.getBuildPlan();

      // extended_stats should depend on base_stats from model1
      expect(plan.graphs).toHaveLength(1);
      const node = plan.graphs[0].nodes[0].find(n =>
        n.sourceID.includes('extended_stats')
      );
      expect(node).toBeDefined();

      // The dependency should include base_stats (from the imported model)
      expect(node!.dependsOn.some(d => d.sourceID.includes('base_stats'))).toBe(
        true
      );
    });

    it('detects persistent base through non-persistent imported extend chain', async () => {
      // Model 1: defines persist source A
      const model1 = `${PERSIST_ANNOTATION}
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: source_a is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `;

      // Model 2: imports model1, extends A to create B (NOT persist)
      const model2 = `${PERSIST_ANNOTATION}
        import "test://model1.malloy"

        source: source_b is source_a extend {
          dimension: b_field is 'b'
        }
      `;

      // Model 3: imports model2, extends B to create C (NOT persist)
      const model3 = `${PERSIST_ANNOTATION}
        import "test://model2.malloy"

        source: source_c is source_b extend {
          dimension: c_field is 'c'
        }
      `;

      testFileSpace.setFile(new URL('test://model1.malloy'), model1);
      testFileSpace.setFile(new URL('test://model2.malloy'), model2);
      testFileSpace.setFile(new URL('test://model3.malloy'), model3);

      const testModel = {
        model: tstRuntime.loadModel(new URL('test://model3.malloy')),
        dialect: tstRuntime.dialect,
      };
      const model = await testModel.model.getModel();

      const plan = model.getBuildPlan();

      // Persistence is inherited through extends chain, so all three sources
      // are persistent. source_c is the root (nothing depends on it).
      // All three will generate the same SQL and use the same build artifact.
      expect(plan.graphs).toHaveLength(1);
      const graph = plan.graphs[0];

      // Build graph has 1 level with the root node (source_c)
      // Dependencies are nested in dependsOn
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]).toHaveLength(1);

      // Root: source_c
      const source_c = graph.nodes[0][0];
      expect(source_c.sourceID).toContain('source_c');

      // source_c depends on source_b
      expect(source_c.dependsOn).toHaveLength(1);
      const source_b = source_c.dependsOn[0];
      expect(source_b.sourceID).toContain('source_b');

      // source_b depends on source_a
      expect(source_b.dependsOn).toHaveLength(1);
      const source_a = source_b.dependsOn[0];
      expect(source_a.sourceID).toContain('source_a');

      // source_a has no dependencies
      expect(source_a.dependsOn).toHaveLength(0);
    });

    it('breaks persistence inheritance with #@ -persist', async () => {
      // Model 1: defines persist source A
      const model1 = `${PERSIST_ANNOTATION}
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: source_a is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
      `;

      // Model 2: imports model1, extends A to create B with #@ -persist
      // This breaks the persistence inheritance chain
      const model2 = `${PERSIST_ANNOTATION}
        import "test://model1.malloy"

        #@ -persist
        source: source_b is source_a extend {
          dimension: b_field is 'b'
        }
      `;

      // Model 3: imports model2, extends B to create C (NOT persistent)
      // source_c is not persistent because source_b broke the chain
      const model3 = `${PERSIST_ANNOTATION}
        import "test://model2.malloy"

        source: source_c is source_b extend {
          dimension: c_field is 'c'
        }
      `;

      testFileSpace.setFile(new URL('test://model1.malloy'), model1);
      testFileSpace.setFile(new URL('test://model2.malloy'), model2);
      testFileSpace.setFile(new URL('test://model3.malloy'), model3);

      const testModel = {
        model: tstRuntime.loadModel(new URL('test://model3.malloy')),
        dialect: tstRuntime.dialect,
      };
      const model = await testModel.model.getModel();

      const plan = model.getBuildPlan();

      // Only source_a is persistent - source_b used #@ -persist to break the chain
      expect(plan.graphs).toHaveLength(1);
      const graph = plan.graphs[0];

      // Build graph has 1 level with just source_a
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0]).toHaveLength(1);

      // Root: source_a (the only persistent source)
      const source_a = graph.nodes[0][0];
      expect(source_a.sourceID).toContain('source_a');
      expect(source_a.dependsOn).toHaveLength(0);
    });
  });

  describe('experimental.persistence annotation requirement', () => {
    it('getBuildPlan throws without experimental.persistence annotation', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        #@ persist
        source: carrier_stats is flights -> {
          group_by: carrier
          aggregate: flight_count is count()
        }
        `
      );
      const model = await testModel.model.getModel();

      expect(() => model.getBuildPlan()).toThrow('experimental.persistence');
    });

    it('running query with buildManifest throws without experimental.persistence annotation', async () => {
      const testModel = wrapTestModel(
        tstRuntime,
        `
        source: flights is ${tstDB}.table('malloytest.flights')

        query: test_query is flights -> { group_by: carrier }
        `
      );

      const manifest = createManifest();

      await expect(
        testModel.model
          .loadQueryByName('test_query')
          .run({buildManifest: manifest})
      ).rejects.toThrow('experimental.persistence');
    });
  });
});
