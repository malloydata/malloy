/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SourceID} from '../../model';
import type {LogMessage} from '../../lang';
import type {PersistNode} from '../../model/persist_utils';
import type {Model, PersistSource} from './core';
import type {BuildTarget, ConnectionBuild} from './types';

/**
 * Read a key this function's own construction guarantees is present.
 *
 * Every key here came out of `targets`, which is fully built before anything
 * reads it back. Saying that once beats five bare `!`s that each look like a
 * claim needing checking.
 */
function mustGet<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error('build target ' + String(key) + ' vanished between passes');
  }
  return value;
}

/**
 * A walk node with its source already resolved.
 *
 * "Is this node a table, and which one" is decided here, once. Deciding it
 * twice — once to collect connection digests and once to fold — means two
 * predicates that have to agree, and a disagreement shows up as a digest
 * missing for a connection that was right there.
 */
export interface ResolvedNode {
  node: PersistNode;
  /** The table this node builds, absent if it is a route or cannot resolve */
  source: PersistSource | undefined;
}

/**
 * Walk the model and resolve each node's source in one pass.
 *
 * Materializing is not laziness lost: the fold needs a connection digest per
 * source and fetching those is async, so the walk has to be crossed twice.
 */
export function resolvePersistWalk(
  model: Model,
  tagParseLog: LogMessage[]
): ResolvedNode[] {
  const resolved: ResolvedNode[] = [];
  for (const node of model._walkPersistSources(tagParseLog)) {
    resolved.push({
      node,
      source: node.persistent
        ? model._persistSourceFor(node.sourceID)
        : undefined,
    });
  }
  return resolved;
}

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

/** A BuildID is a hex digest, so it cannot contain the separator. */
function targetKey(connectionName: string, buildId: string): string {
  return `${connectionName}:${buildId}`;
}

/** Append without repeating. */
function addUnique(into: string[], seen: Set<string>, keys: string[]): void {
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key);
      into.push(key);
    }
  }
}

/**
 * Fold a walk into the artifacts it produces, grouped by connection and in
 * dependency order.
 *
 * The walk emits persistable *sources*; a builder needs *tables*, and several
 * sources routinely land on one (see `BuildTarget`). This merges them by
 * BuildID, keeping every source that mapped onto a target in `target.sources`.
 *
 * One pass suffices because the walk is in dependency order: by the time a
 * source arrives, everything it references has already been placed, so its
 * edges can be written immediately. A source that is not itself a table
 * contributes its children's targets to whoever referenced it, which is how an
 * edge survives a route.
 *
 * Targets come back in dependency order, but no coarser schedule than that —
 * a builder wanting concurrency reads `dependsOn` and starts each target when
 * its own dependencies finish, which waits on strictly less than batching by
 * depth would.
 *
 * Separate from `Runtime.getBuildTargets` because given the digests it is
 * pure, and can be tested without a connection.
 *
 * @param walk A resolved walk from {@link resolvePersistWalk}, in order
 * @param connectionDigests One digest per connection named by a persist source
 */
export function mkBuildTargets(
  walk: ResolvedNode[],
  connectionDigests: Record<string, string>
): ConnectionBuild[] {
  const targets = new Map<string, PartialTarget>();
  // What each source hands to whoever referenced it: its own target if it is
  // one, otherwise whatever it was a route to.
  const contributes = new Map<SourceID, string[]>();

  for (const {node, source} of walk) {
    const childKeys: string[] = [];
    const seen = new Set<string>();
    for (const dep of node.dependsOn) {
      addUnique(childKeys, seen, contributes.get(dep) ?? []);
    }

    if (source === undefined) {
      // A route, or a source whose definition could not be resolved. Either
      // way it is not a table; pass its dependencies up.
      contributes.set(node.sourceID, childKeys);
      continue;
    }

    const connectionName = source.connectionName;
    const digest = connectionDigests[connectionName];
    if (digest === undefined) {
      throw new Error(
        `No connection digest for '${connectionName}', needed to compute the ` +
          `BuildID of '${node.sourceID}'. Supply a digest for every connection ` +
          'named by a persist source.'
      );
    }

    const sql = source.getSQL();
    const buildId = source.makeBuildId(digest, sql);
    const key = targetKey(connectionName, buildId);

    let target = targets.get(key);
    if (target === undefined) {
      target = {
        buildId,
        connectionName,
        sql,
        sources: [],
        dependsOn: new Set<string>(),
      };
      targets.set(key, target);
    }
    const mine = new Set<string>();
    for (const childKey of childKeys) {
      // A child on my own key is an extension of me — the same table twice,
      // not a dependency.
      if (childKey === key) continue;
      // Connections are reported as independent builds, which is only sound
      // because a query cannot span two connections and so a dependency
      // cannot either. Malloy does not currently reject a model that writes
      // one — see #3030 — so this can fire on a model that compiled. Better
      // here than in a builder that ran the two connections in parallel and
      // lost the ordering with nothing to warn it.
      const childConnection = mustGet(targets, childKey).connectionName;
      if (childConnection !== connectionName) {
        throw new Error(
          `'${node.sourceID}' on connection '${connectionName}' depends on a ` +
            `table on '${childConnection}'. Malloy cannot run a query across ` +
            'two connections, so this model cannot be built.'
        );
      }
      mine.add(childKey);
    }

    // Sources on one target have identical SQL, so they have identical *real*
    // dependencies — whatever that SQL inlines. What differs between them is
    // the over-approximation: the walk follows every join, active or not, so a
    // source can record a dependency its SQL does not contain. Intersecting
    // keeps every real edge (each source's set is a superset of the real one)
    // and drops the spurious ones.
    //
    // Not academic. `source: alias is base extend { join_one: mid }` where
    // `mid` reads `base`: alias materializes base's table, so it merges onto
    // base's target and brings an edge to `mid`, which depends on base. Union
    // makes that a cycle out of two edges of which only one is real.
    if (target.sources.length === 0) {
      target.dependsOn = mine;
    } else {
      for (const had of [...target.dependsOn]) {
        if (!mine.has(had)) target.dependsOn.delete(had);
      }
    }
    target.sources.push(source);
    contributes.set(node.sourceID, [key]);
  }

  // Every target exists before any `dependsOn` is filled in, so references can
  // point both ways round a diamond.
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
  for (const [key, partial] of targets) {
    const target = mustGet(built, key);
    for (const depKey of partial.dependsOn) {
      target.dependsOn.push(mustGet(built, depKey));
    }
  }

  // Emit dependencies before dependents. Depth-first with a memo: a target is
  // appended once, after everything it reads.
  const byConnection = new Map<string, BuildTarget[]>();
  const placed = new Set<string>();
  const openKeys = new Set<string>();
  const place = (key: string): void => {
    if (placed.has(key)) return;
    if (openKeys.has(key)) {
      // A real edge cannot make a cycle: a target's SQL contains its
      // dependencies' SQL inline, so two targets cannot each contain the
      // other. But an edge here is not always a real one — a source merging
      // onto a target can bring a join the target's SQL never mentions, and
      // that is what intersecting the merged sources' edges above removes. If
      // one gets through anyway, say so rather than hang.
      const names = mustGet(targets, key)
        .sources.map(s => s.sourceID)
        .join(', ');
      throw new Error(`Cycle in the persistence build graph at: ${names}`);
    }
    openKeys.add(key);
    for (const depKey of mustGet(targets, key).dependsOn) {
      place(depKey);
    }
    openKeys.delete(key);
    placed.add(key);

    const target = mustGet(built, key);
    const forConnection = byConnection.get(target.connectionName);
    if (forConnection === undefined) {
      byConnection.set(target.connectionName, [target]);
    } else {
      forConnection.push(target);
    }
  };
  for (const key of targets.keys()) {
    place(key);
  }

  const connections: ConnectionBuild[] = [];
  for (const [connectionName, connectionTargets] of byConnection) {
    connections.push({connectionName, targets: connectionTargets});
  }
  return connections;
}
