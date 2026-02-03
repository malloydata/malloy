/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ModelDef,
  PersistableSourceDef,
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
} from './malloy_types';
import {resolveSourceID} from './source_def_utils';
import {annotationToTag} from '../annotation';
import type {BuildNode} from '../api/foundation/types';

/**
 * Source build graph: leveled array for parallel execution.
 * Sources in the same level can be built in parallel.
 */
export type SourceBuildGraph = BuildNode[][];

/**
 * Resolve a source name to its definition from model contents.
 */
function resolveSource(
  modelDef: ModelDef,
  name: string
): SourceDef | undefined {
  const obj = modelDef.contents[name];
  return obj && isSourceDef(obj) ? obj : undefined;
}

/**
 * Check if a source has the #@ persist annotation.
 */
function checkPersistAnnotation(source: SourceDef): boolean {
  if (!source.annotation) return false;
  const {tag} = annotationToTag(source.annotation, {prefix: /^#@ /});
  return tag.has('persist');
}

/**
 * Check if a sourceID is persistent, using lazy evaluation and caching.
 * Sets the persist flag on the registry entry as a side effect.
 */
function isPersistent(sourceID: string, modelDef: ModelDef): boolean {
  const value = modelDef.sourceRegistry[sourceID];
  if (!value) return false;

  if (value.persist === undefined) {
    const sourceDef = resolveSourceID(modelDef, sourceID);
    value.persist = sourceDef ? checkPersistAnnotation(sourceDef) : false;
  }
  return value.persist;
}

/**
 * Find persistent dependencies for a source or query, returning a nested DAG.
 *
 * Walks the full dependency tree but only includes persistent sources in the
 * result. Non-persistent sources are "flattened out" - their persistent
 * dependencies bubble up to become direct dependencies of the caller.
 *
 * Example: source_c (persist) -> source_b (NOT persist) -> source_a (persist)
 * Returns: [{sourceID: source_a, dependsOn: []}]
 * (source_b is flattened out, source_a becomes direct dependency)
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
 * @param root The source or query to find dependencies for
 * @param modelDef The model definition containing the source registry
 * @returns Array of BuildNode representing the persistent dependency DAG
 */
export function findPersistentDependencies(
  root: SourceDef | Query,
  modelDef: ModelDef
): BuildNode[] {
  const visited = new Set<string>();

  function processSourceID(sourceID: string): BuildNode[] {
    if (visited.has(sourceID)) {
      return [];
    }
    visited.add(sourceID);

    const sourceDef = resolveSourceID(modelDef, sourceID);
    if (!sourceDef) {
      return [];
    }

    const childDeps = processSourceDef(sourceDef);
    const persistent = isPersistent(sourceID, modelDef);

    if (persistent) {
      return [{sourceID, dependsOn: childDeps}];
    } else {
      return childDeps;
    }
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
    // If it has a sourceID, go through the registry
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
 * Collect all sourceIDs from a BuildNode forest (for analysis only).
 */
function collectAllSourceIDs(nodes: BuildNode[]): Set<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    result.add(node.sourceID);
    for (const id of collectAllSourceIDs(node.dependsOn)) {
      result.add(id);
    }
  }
  return result;
}

/**
 * Collect all sourceIDs that appear in any dependsOn (for analysis only).
 */
function collectAllDependedOn(nodes: BuildNode[]): Set<string> {
  const result = new Set<string>();
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      result.add(dep.sourceID);
    }
    for (const id of collectAllDependedOn(node.dependsOn)) {
      result.add(id);
    }
  }
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

/**
 * Extract all sourceIDs from a nested BuildNode array (flattens the DAG).
 * @deprecated Use collectAllSourceIDs instead
 */
function extractSourceIDs(nodes: BuildNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.sourceID);
    ids.push(...extractSourceIDs(node.dependsOn));
  }
  return ids;
}

/**
 * Build an internal build graph from persist sources.
 *
 * Performs topological sort to order sources by dependencies.
 * Returns a leveled array where sources in the same level can be built in parallel.
 *
 * @param persistSources Array of PersistableSourceDefs (must have sourceID set)
 * @param modelDef The model definition containing sources
 * @returns Leveled build graph
 */
export function buildSourceGraph(
  persistSources: PersistableSourceDef[],
  modelDef: ModelDef
): SourceBuildGraph {
  // Build set of all persist sourceIDs
  const persistSourceIds = new Set(
    persistSources.map(s => s.sourceID).filter((id): id is string => !!id)
  );

  // Build dependency map using findPersistentDependencies
  const depMap = new Map<string, BuildNode[]>();

  for (const source of persistSources) {
    if (!source.sourceID) continue;
    const deps = findPersistentDependencies(source, modelDef);
    depMap.set(source.sourceID, deps);
  }

  // Topological sort into levels (Kahn's algorithm)
  const levels: SourceBuildGraph = [];
  const remaining = new Set(persistSourceIds);
  const completed = new Set<string>();

  while (remaining.size > 0) {
    // Find all nodes with no unmet dependencies
    const level: BuildNode[] = [];
    for (const sourceID of remaining) {
      const deps = depMap.get(sourceID) ?? [];
      const depIDs = extractSourceIDs(deps);
      const unmetDeps = depIDs.filter(dep => !completed.has(dep));
      if (unmetDeps.length === 0) {
        level.push({
          sourceID,
          dependsOn: deps,
        });
      }
    }

    if (level.length === 0 && remaining.size > 0) {
      // Cycle detected - should not happen with valid persist annotations
      throw new Error(
        `Cycle detected in persist dependencies: ${[...remaining].join(', ')}`
      );
    }

    // Add level and mark as completed
    levels.push(level);
    for (const node of level) {
      remaining.delete(node.sourceID);
      completed.add(node.sourceID);
    }
  }

  return levels;
}
