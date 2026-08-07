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
 * Walk everything a source or query references, and return the graph of the
 * sources that matter to persistence.
 *
 * A source is in the graph if it is persistent — something to build — or if it
 * is the *route* to something persistent. Everything else is dropped; a source
 * with nothing persistent beneath it is of no interest to anybody.
 *
 * One rule decides both halves, applied on the way back up:
 *
 *     keep me if I am persistent, or if any child survived
 *
 * The second clause needs no lookahead. A child only survived under this same
 * rule, so a surviving child *is* the proof that something persistent lies
 * below. For `a(persist) → b → c(persist) → d`, d has nothing beneath it and
 * is dropped, c is kept for being persistent, b is kept for leading to c.
 *
 * `keepRoutes` selects between the two things callers want:
 *
 * - **`true`** — the whole graph. An **import** needs this: every sourceID
 *   here must resolve for the walk to be repeatable in the importing model,
 *   and copying only the persistent ones is how an imported source loses its
 *   dependencies, because the walk reaches them *through* nodes that are not
 *   themselves tables.
 * - **`false`** — tables only, which is what a **builder** wants. A route
 *   hands its dependencies straight to whoever pointed at it, so an edge
 *   survives wherever a route exists. That is
 *   {@link findPersistentDependencies}.
 *
 * With `keepRoutes: false` the "did any child survive" clause never fires —
 * a route returns its children rather than itself, so nothing is left to
 * decide.
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
 * @param root The source or query to walk
 * @param modelDef The model definition containing the source registry
 * @param tagParseLog Collects errors from parsing `#@` annotations
 * @param keepRoutes Keep the non-persistent sources the walk passed through
 * @returns The graph of persistent sources, with or without their routes
 */
export function walkPersistentDependencies(
  root: SourceDef | Query,
  modelDef: ModelDef,
  tagParseLog: LogMessage[] = [],
  keepRoutes = true
): BuildNode[] {
  // Memoized, not merely visited: a source reached a second time returns the
  // same nodes it returned the first time. Returning [] instead — which this
  // did — dropped the second dependent's edge, so in a diamond only one of the
  // two readers recorded the shared dependency and the other claimed to have
  // none. A depth-first flatten hid that, because the dependency got built on
  // the other reader's account anyway; a schedule of independent batches does
  // not.
  const done = new Map<string, BuildNode[]>();
  const openIDs = new Set<string>();

  function processSourceID(sourceID: string): BuildNode[] {
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
    let result: BuildNode[] = [];
    if (sourceDef) {
      const dependsOn = processSourceDef(sourceDef);
      const persistent = isPersistent(sourceID, modelDef, tagParseLog);
      if (persistent) {
        result = [{sourceID, persistent, dependsOn}];
      } else if (keepRoutes) {
        // A route is worth keeping only if it leads somewhere. A child
        // survived under this same rule, so one surviving child is the proof
        // that something persistent lies below.
        result =
          dependsOn.length > 0 ? [{sourceID, persistent, dependsOn}] : [];
      } else {
        // No routes: hand my dependencies to whoever pointed at me, so an edge
        // survives wherever a route exists.
        result = dependsOn;
      }
    }

    openIDs.delete(sourceID);
    done.set(sourceID, result);
    return result;
  }

  function processSourceDef(source: SourceDef): BuildNode[] {
    const results: BuildNode[] = [];

    // Path 4: PersistableSourceDef.extends
    if (isPersistableSourceDef(source) && source.extends) {
      results.push(...processSourceID(source.extends));
    }

    // Path 6: QuerySourceDef.query
    if (source.type === 'query_source') {
      results.push(...processQuery(source.query));
    }

    // Path 5: SQLSourceDef.selectSegments[]
    if (source.type === 'sql_select' && source.selectSegments) {
      for (const segment of source.selectSegments) {
        results.push(...processSQLSegment(segment));
      }
    }

    // Path 3: SourceDef.fields[] - joins defined on the source
    for (const field of source.fields) {
      if (isJoined(field) && isSourceDef(field)) {
        results.push(...processJoinedSource(field));
      }
    }

    return results;
  }

  function processQuery(query: Query): BuildNode[] {
    const results: BuildNode[] = [];

    // Path 1: Query.structRef
    results.push(...processStructRef(query.structRef));

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
              results.push(...processJoinedSource(field));
            }
          }
        }
      }
    }

    return results;
  }

  function processJoinedSource(source: SourceDef): BuildNode[] {
    // If it has an sourceID, go through the registry
    if (isPersistableSourceDef(source) && source.sourceID) {
      return processSourceID(source.sourceID);
    }
    // Otherwise walk through it transparently
    return processSourceDef(source);
  }

  function processStructRef(ref: StructRef): BuildNode[] {
    if (typeof ref === 'string') {
      const source = resolveSource(modelDef, ref);
      if (!source) return [];
      if (isPersistableSourceDef(source) && source.sourceID) {
        return processSourceID(source.sourceID);
      }
      return processSourceDef(source);
    } else if (isSourceDef(ref)) {
      if (isPersistableSourceDef(ref) && ref.sourceID) {
        return processSourceID(ref.sourceID);
      }
      return processSourceDef(ref);
    }
    return [];
  }

  function processSQLSegment(segment: SQLPhraseSegment): BuildNode[] {
    if (isSegmentSQL(segment)) {
      return [];
    } else if (isSegmentSource(segment)) {
      if (isPersistableSourceDef(segment) && segment.sourceID) {
        return processSourceID(segment.sourceID);
      }
      return processSourceDef(segment);
    } else {
      // It's a Query
      return processQuery(segment);
    }
  }

  // Entry point: handle both SourceDef and Query
  // Query has required 'structRef', SourceDef does not
  if ('structRef' in root) {
    return processQuery(root);
  } else {
    // If the root source itself is persistable and has a sourceID, process it through
    // processSourceID so it gets included in the result if persistent
    if (isPersistableSourceDef(root) && root.sourceID) {
      return processSourceID(root.sourceID);
    }
    return processSourceDef(root);
  }
}

/**
 * The persistent sources a source or query depends on, as a DAG.
 *
 * A source that is not itself persistent never appears; its persistent
 * dependencies become direct dependencies of whoever referenced it. So
 * `c (persist) → b → a (persist)` yields `[{sourceID: a, dependsOn: []}]`.
 *
 * This is {@link walkPersistentDependencies} with the routes left out. A caller
 * that needs to know which sources were *traversed* — an import deciding what
 * to copy — wants the routes, so it calls the walk directly.
 */
export function findPersistentDependencies(
  root: SourceDef | Query,
  modelDef: ModelDef,
  tagParseLog: LogMessage[] = []
): BuildNode[] {
  return walkPersistentDependencies(root, modelDef, tagParseLog, false);
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
