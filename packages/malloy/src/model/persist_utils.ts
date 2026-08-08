/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ModelDef,
  SourceDef,
  SQLPhraseSegment,
  Query,
  QuerySegment,
  SourceID,
  StructRef,
} from './malloy_types';
import {
  isSourceDef,
  isSegmentSQL,
  isPersistableSourceDef,
  isJoined,
  isSegmentSource,
  safeRecordGet,
} from './malloy_types';
import {resolveSourceID} from './source_def_utils';
import {Annotations} from '../api/foundation/annotation';
import type {LogMessage} from '../lang';
import type {BuildNode} from '../api/foundation/types';

/**
 * Resolve a source name to its definition from model contents.
 */
function resolveSource(
  modelDef: ModelDef,
  name: string
): SourceDef | undefined {
  const obj = safeRecordGet(modelDef.contents, name);
  return obj && isSourceDef(obj) ? obj : undefined;
}

/**
 * Check if a source has the #@ persist annotation.
 * Returns both the persist flag and any tag parse errors.
 */
export function checkPersistAnnotation(source: SourceDef): {
  persist: boolean;
  log: LogMessage[];
} {
  if (!source.annotations) return {persist: false, log: []};
  const {tag, log} = new Annotations(source.annotations).parseAsTag('@');
  return {persist: tag.has('persist'), log};
}

/**
 * Check if a sourceID is persistent, using lazy evaluation and caching.
 * Sets the persist flag on the registry entry as a side effect.
 * Appends any tag parse errors to the provided log array.
 */
function isPersistent(
  sourceID: string,
  modelDef: ModelDef,
  tagParseLog: LogMessage[]
): boolean {
  const value = modelDef.sourceRegistry[sourceID];
  if (!value) return false;

  if (value.persist === undefined) {
    const sourceDef = resolveSourceID(modelDef, sourceID);
    if (sourceDef) {
      const result = checkPersistAnnotation(sourceDef);
      value.persist = result.persist;
      tagParseLog.push(...result.log);
    } else {
      value.persist = false;
    }
  }
  return value.persist;
}

/**
 * One persistable source the walk found, and the sources it directly
 * references.
 *
 * Edges are sourceIDs rather than nested nodes, so there is no shared object
 * to be careful about and nothing to recurse through — a consumer folds the
 * stream in one pass.
 */
export interface PersistNode {
  sourceID: SourceID;
  /**
   * Whether this source is itself something to build. `false` means it is a
   * *route*: it materializes nothing, but it is how the walk reached something
   * that does.
   */
  persistent: boolean;
  /** The sources it reaches directly, each of which was yielded already */
  dependsOn: SourceID[];
}

/**
 * A walk in progress: yields a {@link PersistNode} per source kept, and
 * finally returns the sources the roots themselves reached.
 */
export type PersistWalk = Generator<PersistNode, SourceID[]>;

/**
 * Walk everything a source or query references, and emit the sources that
 * matter to persistence — in dependency order, each one after everything it
 * depends on.
 *
 * A source is emitted if it is persistent — something to build — or if it
 * is the *route* to something persistent. Everything else is dropped; a
 * source with nothing persistent beneath it is of no interest to anybody.
 *
 * One rule decides both halves, applied on the way back up:
 *
 *     keep me if I am persistent, or if any child survived
 *
 * The second clause needs no lookahead. A child only survived under this same
 * rule, so a surviving child *is* the proof that something persistent lies
 * below. For `a(persist) → b → c(persist) → d`, d has nothing beneath it
 * and is dropped, c is kept for being persistent, b is kept for leading to c.
 *
 * Because a node arrives only after everything it depends on, a consumer can
 * fold the stream in a single pass with no second lookup — whether it wants
 * every source touched, or only the ones that are tables.
 *
 * ## The 6 Dependency Paths in the IR
 *
 * Starting from a Query or SourceDef, these are ALL the ways a SourceDef
 * can be referenced (and thus must be walked for dependency tracking):
 *
 * 1. **Query.structRef** → SourceDef (the FROM clause)
 * 2. **Query.pipeline[].extendSource[]** → JoinFieldDef (joins in extend blocks)
 * 3. **SourceDef.fields[]** → JoinFieldDef (joins defined on a source)
 * 4. **PersistableSourceDef.extends** → SourceID (extend chain reference)
 * 5. **SQLSourceDef.selectSegments[]** → Query | PersistableSourceDef (SQL interpolation)
 * 6. **QuerySourceDef.query** → Query (nested query in query_source)
 *
 * Note: CompositeSourceDef.sources[] is ignored - composite sources and
 * persistence may be incompatible features.
 *
 * Joins are followed whether or not a query activates them, so what comes back
 * is what a source *could* depend on. An unused join is a dependency the SQL
 * will not contain — an over-approximation, which costs ordering freedom and
 * never correctness.
 *
 * @param roots The sources and queries to walk, sharing one memo
 * @param modelDef The model definition containing the source registry
 * @param tagParseLog Collects errors from parsing `#@` annotations
 */
export function* walkPersistentDependencies(
  roots: (SourceDef | Query)[],
  modelDef: ModelDef,
  tagParseLog: LogMessage[] = []
): PersistWalk {
  // Memoized, not merely visited: a source reached a second time reports the
  // same answer it gave the first time, so every dependent records the edge
  // rather than only the first one to arrive. The memo spans every root, so a
  // subtree two model objects both reach is walked once and yielded once.
  const done = new Map<SourceID, SourceID[]>();
  const openIDs = new Set<SourceID>();

  function* processSourceID(sourceID: SourceID): PersistWalk {
    const memo = done.get(sourceID);
    if (memo !== undefined) {
      return memo;
    }
    // A source cannot reach itself, but a malformed registry could; stop rather
    // than recur forever.
    if (openIDs.has(sourceID)) {
      return [];
    }
    openIDs.add(sourceID);

    const sourceDef = resolveSourceID(modelDef, sourceID);
    let result: SourceID[] = [];
    if (sourceDef) {
      const dependsOn = yield* processSourceDef(sourceDef);
      const persistent = isPersistent(sourceID, modelDef, tagParseLog);
      // Kept for being a table, or for being the road to one. Yielded after
      // its dependencies, which is what lets a consumer fold in one pass.
      if (persistent || dependsOn.length > 0) {
        yield {sourceID, persistent, dependsOn};
        result = [sourceID];
      }
    }

    openIDs.delete(sourceID);
    done.set(sourceID, result);
    return result;
  }

  /** Concatenate what several paths found, without repeating a source. */
  function* gather(parts: Iterable<PersistWalk>): PersistWalk {
    const found: SourceID[] = [];
    const seen = new Set<SourceID>();
    for (const part of parts) {
      for (const id of yield* part) {
        if (!seen.has(id)) {
          seen.add(id);
          found.push(id);
        }
      }
    }
    return found;
  }

  function* processSourceDef(source: SourceDef): PersistWalk {
    const parts: PersistWalk[] = [];

    // Path 4: PersistableSourceDef.extends
    if (isPersistableSourceDef(source) && source.extends) {
      parts.push(processSourceID(source.extends));
    }

    // Path 6: QuerySourceDef.query
    if (source.type === 'query_source') {
      parts.push(processQuery(source.query));
    }

    // Path 5: SQLSourceDef.selectSegments[]
    if (source.type === 'sql_select' && source.selectSegments) {
      for (const segment of source.selectSegments) {
        parts.push(processSQLSegment(segment));
      }
    }

    // Path 3: SourceDef.fields[] - joins defined on the source
    for (const field of source.fields) {
      if (isJoined(field) && isSourceDef(field)) {
        parts.push(processJoinedSource(field));
      }
    }

    return yield* gather(parts);
  }

  function* processQuery(query: Query): PersistWalk {
    const parts: PersistWalk[] = [];

    // Path 1: Query.structRef
    parts.push(processStructRef(query.structRef));

    // Path 2: Query.pipeline[].extendSource[]
    for (const segment of query.pipeline) {
      if (
        segment.type === 'reduce' ||
        segment.type === 'project' ||
        segment.type === 'partial'
      ) {
        const querySegment = segment as QuerySegment;
        if (querySegment.extendSource) {
          for (const field of querySegment.extendSource) {
            if (isJoined(field) && isSourceDef(field)) {
              parts.push(processJoinedSource(field));
            }
          }
        }
      }
    }

    return yield* gather(parts);
  }

  function* processJoinedSource(source: SourceDef): PersistWalk {
    // If it has an sourceID, go through the registry
    if (isPersistableSourceDef(source) && source.sourceID) {
      return yield* processSourceID(source.sourceID);
    }
    // Otherwise walk through it transparently
    return yield* processSourceDef(source);
  }

  function* processStructRef(ref: StructRef): PersistWalk {
    if (typeof ref === 'string') {
      const source = resolveSource(modelDef, ref);
      if (!source) return [];
      if (isPersistableSourceDef(source) && source.sourceID) {
        return yield* processSourceID(source.sourceID);
      }
      return yield* processSourceDef(source);
    } else if (isSourceDef(ref)) {
      if (isPersistableSourceDef(ref) && ref.sourceID) {
        return yield* processSourceID(ref.sourceID);
      }
      return yield* processSourceDef(ref);
    }
    return [];
  }

  function* processSQLSegment(segment: SQLPhraseSegment): PersistWalk {
    if (isSegmentSQL(segment)) {
      return [];
    } else if (isSegmentSource(segment)) {
      if (isPersistableSourceDef(segment) && segment.sourceID) {
        return yield* processSourceID(segment.sourceID);
      }
      return yield* processSourceDef(segment);
    } else {
      // It's a Query
      return yield* processQuery(segment);
    }
  }

  // Entry point: a Query has a required 'structRef', a SourceDef does not.
  return yield* gather(
    roots.map(root => {
      if ('structRef' in root) {
        return processQuery(root);
      }
      // A root that is persistable and named goes through processSourceID so
      // it appears in its own right if it is persistent.
      if (isPersistableSourceDef(root) && root.sourceID) {
        return processSourceID(root.sourceID);
      }
      return processSourceDef(root);
    })
  );
}

/**
 * The persistent sources a source or query depends on, as a nested DAG.
 *
 * A source that is not itself persistent never appears; its persistent
 * dependencies become direct dependencies of whoever referenced it. So
 * `c (persist) → b → a (persist)` yields `[{sourceID: a, dependsOn: []}]`.
 *
 * @deprecated The nested shape exists for `Model.getBuildPlan()`, which is on
 * its way out. Consume {@link walkPersistentDependencies} directly.
 */
export function findPersistentDependencies(
  root: SourceDef | Query,
  modelDef: ModelDef,
  tagParseLog: LogMessage[] = []
): BuildNode[] {
  // What each source contributes to whoever referenced it: itself if it is a
  // table, otherwise whatever it was a route to. Post-order means every
  // dependency is already in the map by the time its dependent arrives.
  const contributes = new Map<SourceID, BuildNode[]>();
  const walk = walkPersistentDependencies([root], modelDef, tagParseLog);

  let step = walk.next();
  while (!step.done) {
    const node = step.value;
    // Two of a source's references can lead to one table — a join and an
    // extend of the same thing, say. That is one dependency, listed once.
    const dependsOn: BuildNode[] = [];
    const seen = new Set<BuildNode>();
    for (const id of node.dependsOn) {
      for (const dep of contributes.get(id) ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep);
          dependsOn.push(dep);
        }
      }
    }
    contributes.set(
      node.sourceID,
      node.persistent ? [{sourceID: node.sourceID, dependsOn}] : dependsOn
    );
    step = walk.next();
  }

  // The generator's return value is what the root itself reached — the only
  // thing a `for...of` would throw away.
  //
  // Deduplicated because two routes can land on one table: a source reached
  // through two different `#@ -persist` wrappers contributes the same node
  // twice, and this function has always returned each node once.
  const roots: BuildNode[] = [];
  const rootSeen = new Set<BuildNode>();
  for (const id of step.value) {
    for (const node of contributes.get(id) ?? []) {
      if (!rootSeen.has(node)) {
        rootSeen.add(node);
        roots.push(node);
      }
    }
  }
  return roots;
}

/**
 * Collect all sourceIDs from a BuildNode forest (for analysis only).
 *
 * A forest shares nodes — one memoized node is reachable from every dependent
 * that reads it — so the walk tracks which nodes it has already descended into.
 */
function collectAllSourceIDs(nodes: BuildNode[]): Set<string> {
  const result = new Set<string>();
  const seen = new Set<BuildNode>();
  function visit(node: BuildNode) {
    if (seen.has(node)) return;
    seen.add(node);
    result.add(node.sourceID);
    for (const dep of node.dependsOn) visit(dep);
  }
  for (const node of nodes) visit(node);
  return result;
}

/**
 * Collect all sourceIDs that appear in any dependsOn (for analysis only).
 */
function collectAllDependedOn(nodes: BuildNode[]): Set<string> {
  const result = new Set<string>();
  const seen = new Set<BuildNode>();
  function visit(node: BuildNode) {
    if (seen.has(node)) return;
    seen.add(node);
    for (const dep of node.dependsOn) {
      result.add(dep.sourceID);
      visit(dep);
    }
  }
  for (const node of nodes) visit(node);
  return result;
}

/**
 * Find the minimal set of root build graphs from a forest of BuildNodes.
 *
 * Uses flattening for ANALYSIS ONLY to identify unique nodes and find roots.
 * Returns original graph structures (NOT flattened) - preserves branching
 * for parallel builds.
 *
 * Roots are sourceIDs that exist but nothing depends on them - these are
 * the entry points for building.
 *
 * @param deps Array of BuildNode trees (potentially overlapping)
 * @returns Array of root BuildNode trees (deduplicated)
 */
export function minimalBuildGraph(deps: BuildNode[]): BuildNode[] {
  if (deps.length === 0) return [];

  // Use flattening for analysis only
  const allSourceIDs = collectAllSourceIDs(deps);
  const dependedOn = collectAllDependedOn(deps);

  // Roots are sourceIDs that exist but nothing depends on them
  const rootIDs = new Set<string>();
  for (const id of allSourceIDs) {
    if (!dependedOn.has(id)) {
      rootIDs.add(id);
    }
  }

  // Return original graph structures for roots (deduplicated by sourceID)
  const seen = new Set<string>();
  const roots: BuildNode[] = [];
  for (const node of deps) {
    if (rootIDs.has(node.sourceID) && !seen.has(node.sourceID)) {
      seen.add(node.sourceID);
      roots.push(node);
    }
  }

  return roots;
}
