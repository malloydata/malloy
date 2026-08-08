/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {SourceID} from '../../model';
import type {PersistNode} from '../../model/persist_utils';
import type {Model, PersistSource} from './core';
import type {BuildTarget, ConnectionBuild} from './types';

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
 * connections cannot produce the same key from the same SQL. Keying on both
 * says what a target is rather than relying on that.
 */
function targetKey(connectionName: string, buildId: string): string {
  // A BuildID is a hex digest, so it cannot contain the separator and no two
  // distinct pairs can produce the same key.
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
 * The walk emits persistable *sources*; a builder needs *tables*. Several
 * sources routinely land on one table — `#@ persist` is inherited and `extend`
 * never changes a source's SQL — so this merges them by BuildID, and keeps
 * every source that mapped onto a target in `target.sources`.
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
 * Separate from `Runtime.getBuildTargets` because it needs no connection —
 * given the digests it is pure, and can be tested against a model alone.
 *
 * @param nodes A walk from `Model._walkPersistSources()`, in order
 * @param model The model those sources belong to
 * @param connectionDigests One digest per connection named by a persist source
 */
export function mkBuildTargets(
  nodes: PersistNode[],
  model: Model,
  connectionDigests: Record<string, string>
): ConnectionBuild[] {
  const targets = new Map<string, PartialTarget>();
  // What each source hands to whoever referenced it: its own target if it is
  // one, otherwise whatever it was a route to.
  const contributes = new Map<SourceID, string[]>();

  for (const node of nodes) {
    const childKeys: string[] = [];
    const seen = new Set<string>();
    for (const dep of node.dependsOn) {
      addUnique(childKeys, seen, contributes.get(dep) ?? []);
    }

    const source = node.persistent
      ? model._persistSourceFor(node.sourceID)
      : undefined;
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
    target.sources.push(source);
    for (const childKey of childKeys) {
      // A child on my own key is an extension of me — the same table twice,
      // not a dependency.
      if (childKey !== key) {
        target.dependsOn.add(childKey);
      }
    }
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
    const target = built.get(key)!;
    for (const depKey of partial.dependsOn) {
      target.dependsOn.push(built.get(depKey)!);
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
      // Unreachable for a well-formed model: a target's SQL contains its
      // dependencies' SQL inline, so two targets cannot each contain the
      // other. Loud beats hanging if that ever stops being true.
      const names = targets
        .get(key)!
        .sources.map(s => s.sourceID)
        .join(', ');
      throw new Error(`Cycle in the persistence build graph at: ${names}`);
    }
    openKeys.add(key);
    for (const depKey of targets.get(key)!.dependsOn) {
      place(depKey);
    }
    openKeys.delete(key);
    placed.add(key);

    const target = built.get(key)!;
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
