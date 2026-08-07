/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BuildPlan, PersistSource} from './core';
import type {BuildNode, BuildTarget} from './types';

/**
 * A target under construction. `dependsOn` is held as keys until every target
 * exists, then rewritten as references.
 */
interface PartialTarget {
  buildId: string;
  connectionName: string;
  sql: string;
  sources: PersistSource[];
  dependsOn: Set<string>;
}

/**
 * A target is a table on a connection. The manifest is keyed by BuildID alone,
 * but the digest that BuildID is computed from is the connection's, so two
 * connections cannot produce the same key from the same SQL. Keying the merge
 * on both says what a target is rather than relying on that.
 */
function targetKey(connectionName: string, buildId: string): string {
  return `${connectionName}:${buildId}`;
}

/**
 * Turn a build plan into the artifacts it actually produces, leveled.
 *
 * The plan enumerates persistable *sources*. This collapses them onto the
 * *tables* they build — one target per BuildID per connection — and levels the
 * result so that every target's dependencies sit strictly earlier.
 *
 * Separate from `Runtime.getBuildTargets` only because it needs no connection:
 * given the digests, it is pure, and can be tested against a plan alone.
 *
 * @param plan A plan from `Model.getBuildPlan()`
 * @param connectionDigests One digest per connection named in the plan
 * @return Levels of targets, in build order
 */
export function mkBuildTargets(
  plan: BuildPlan,
  connectionDigests: Record<string, string>
): BuildTarget[][] {
  // --- Edges between sources -------------------------------------------
  // The plan is a forest of roots whose dependencies hang off `dependsOn`, and
  // the same source appears under every dependent that reads it. Union the
  // edges by sourceID; walk each node object once.
  const depsBySource = new Map<string, Set<string>>();
  const seen = new Set<BuildNode>();
  const walk = (node: BuildNode): void => {
    let deps = depsBySource.get(node.sourceID);
    if (deps === undefined) {
      deps = new Set<string>();
      depsBySource.set(node.sourceID, deps);
    }
    for (const dep of node.dependsOn) {
      deps.add(dep.sourceID);
    }
    if (seen.has(node)) return;
    seen.add(node);
    for (const dep of node.dependsOn) {
      walk(dep);
    }
  };
  for (const graph of plan.graphs) {
    for (const node of graph.nodes.flat()) {
      walk(node);
    }
  }

  // --- Sources onto targets ---------------------------------------------
  const targets = new Map<string, PartialTarget>();
  const keyOf = new Map<string, string>();
  for (const sourceID of depsBySource.keys()) {
    const source = plan.sources[sourceID];
    // A node whose definition could not be resolved has no SQL and cannot be
    // built. It is not a target, and edges through it are dropped with it.
    if (source === undefined) continue;

    const connectionName = source.connectionName;
    const digest = connectionDigests[connectionName];
    if (digest === undefined) {
      throw new Error(
        `No connection digest for '${connectionName}', needed to compute the ` +
          `BuildID of '${sourceID}'. Supply a digest for every connection ` +
          'named in the plan.'
      );
    }

    const sql = source.getSQL();
    const buildId = source.makeBuildId(digest, sql);
    const key = targetKey(connectionName, buildId);
    keyOf.set(sourceID, key);

    const existing = targets.get(key);
    if (existing) {
      existing.sources.push(source);
    } else {
      targets.set(key, {
        buildId,
        connectionName,
        sql,
        sources: [source],
        dependsOn: new Set<string>(),
      });
    }
  }

  // --- Edges between targets --------------------------------------------
  // A source that depends on a source mapping onto its own artifact — an
  // extension of a persisted source is the ordinary case — becomes a self
  // edge, which is not a dependency but the same table twice.
  for (const [sourceID, deps] of depsBySource) {
    const key = keyOf.get(sourceID);
    if (key === undefined) continue;
    const target = targets.get(key)!;
    for (const depID of deps) {
      const depKey = keyOf.get(depID);
      if (depKey === undefined || depKey === key) continue;
      target.dependsOn.add(depKey);
    }
  }

  // --- Levels ------------------------------------------------------------
  // A target's level is the longest path to it, so it lands strictly after
  // everything it reads however many ways there are to reach it.
  const levelOfKey = new Map<string, number>();
  const onStack = new Set<string>();
  const levelOf = (key: string): number => {
    const known = levelOfKey.get(key);
    if (known !== undefined) return known;
    if (onStack.has(key)) {
      // Unreachable for a well-formed model: a target's SQL contains its
      // dependencies' SQL inline, so two targets cannot each contain the
      // other. Loud beats hanging if that ever stops being true.
      const names = targets
        .get(key)!
        .sources.map(s => s.sourceID)
        .join(', ');
      throw new Error(`Cycle in the persistence build graph at: ${names}`);
    }
    onStack.add(key);
    let level = 0;
    for (const depKey of targets.get(key)!.dependsOn) {
      level = Math.max(level, levelOf(depKey) + 1);
    }
    onStack.delete(key);
    levelOfKey.set(key, level);
    return level;
  };

  // Every target exists before any `dependsOn` is filled in, so the references
  // can point both ways round a diamond.
  const built = new Map<string, BuildTarget>();
  for (const [key, partial] of targets) {
    built.set(key, {
      buildId: partial.buildId,
      connectionName: partial.connectionName,
      sql: partial.sql,
      sources: partial.sources,
      dependsOn: [],
    });
  }
  const levels: BuildTarget[][] = [];
  for (const [key, partial] of targets) {
    const target = built.get(key)!;
    for (const depKey of partial.dependsOn) {
      target.dependsOn.push(built.get(depKey)!);
    }
    const level = levelOf(key);
    while (levels.length <= level) levels.push([]);
    levels[level].push(target);
  }

  return levels;
}
