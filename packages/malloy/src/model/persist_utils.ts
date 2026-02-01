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
  FieldDef,
} from './malloy_types';
import {
  isSourceDef,
  isSegmentSQL,
  isPersistableSourceDef,
  isJoined,
  isSegmentSource,
} from './malloy_types';

/**
 * A node in the source build graph.
 * Uses sourceID (name@url) for identity.
 */
export interface SourceBuildNode {
  sourceID: string;
  dependsOn: string[];
}

/**
 * Source build graph: leveled array for parallel execution.
 * Sources in the same level can be built in parallel.
 */
export type SourceBuildGraph = SourceBuildNode[][];

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
 * Find all persist source dependencies for a persistable source.
 *
 * Dependency detection rules:
 *
 * For sql_select sources:
 * - Walk selectSegments for interpolation elements
 * - If element is a persistable source with sourceID → dependency
 * - If element is a query → walk that query
 *
 * For query_source sources:
 * - Check structRef → if it resolves to a source with persistent sourceID → dependency
 * - Walk each pipeline stage's extendSource for joins
 * - If joined structdef has persistent sourceID → dependency
 *
 * NOT dependencies:
 * - Fields array of a source (joins there are from the source definition, not the query)
 *
 * @returns Array of dependency sourceIDs
 */
function findSourceDependencies(
  source: PersistableSourceDef,
  modelDef: ModelDef,
  persistSourceIds: Set<string>
): string[] {
  const deps: string[] = [];
  const visited = new Set<string>();

  function addDep(sourceID: string) {
    if (!visited.has(sourceID) && persistSourceIds.has(sourceID)) {
      visited.add(sourceID);
      deps.push(sourceID);
    }
  }

  /**
   * Check a StructRef for persistent dependencies.
   * If it's a persistable source with sourceID, add it as a dependency.
   * If it's a query_source (persistent or not), walk its inner query
   * to find transitive persistent dependencies.
   */
  function checkStructRef(ref: StructRef) {
    if (typeof ref === 'string') {
      // It's a reference to a named source - resolve it
      const referencedSource = resolveSource(modelDef, ref);
      if (referencedSource) {
        checkSourceDef(referencedSource);
      }
    } else if (isSourceDef(ref)) {
      checkSourceDef(ref);
    }
  }

  /**
   * Check a SourceDef for persistent dependencies.
   */
  function checkSourceDef(source: SourceDef) {
    // If this source is persistable with a sourceID, it's a direct dependency
    if (isPersistableSourceDef(source) && source.sourceID) {
      addDep(source.sourceID);
    }

    // Follow extends chain to find dependencies through source extensions
    // (e.g., source: b is a extend {...} - if 'a' has sourceID, add it)
    if (isPersistableSourceDef(source) && source.extends) {
      addDep(source.extends);
    }

    // If it's a query_source, walk its inner query for transitive dependencies
    // (even if this source itself is not persistent)
    if (source.type === 'query_source') {
      walkQuery(source.query);
    }
  }

  /**
   * Walk a query looking for dependencies in structRef and pipeline extends.
   */
  function walkQuery(query: Query) {
    // Check the query's source
    checkStructRef(query.structRef);

    // Walk pipeline stages looking for extend blocks with joins
    for (const segment of query.pipeline) {
      if (
        segment.type === 'reduce' ||
        segment.type === 'project' ||
        segment.type === 'partial'
      ) {
        const querySegment = segment as QuerySegment;
        if (querySegment.extendSource) {
          for (const field of querySegment.extendSource) {
            // Check if this is a joined source
            if (isJoined(field) && isSourceDef(field)) {
              if (isPersistableSourceDef(field) && field.sourceID) {
                addDep(field.sourceID);
              }
              // If it's a query_source join, walk its inner query
              if (field.type === 'query_source') {
                walkQuery(field.query);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Walk an SQL segment (from selectSegments).
   */
  function walkSegment(segment: SQLPhraseSegment) {
    if (isSegmentSQL(segment)) {
      return; // Plain SQL - no dependencies
    } else if (isSegmentSource(segment)) {
      // It's a SourceDef (sql_select or query_source) - use checkSourceDef
      // to handle both direct dependencies and transitive walks
      checkSourceDef(segment);
    } else {
      // It's a Query - walk it for dependencies
      walkQuery(segment);
    }
  }

  // Main dispatch based on source type
  if (source.type === 'query_source') {
    walkQuery(source.query);
  } else if (source.type === 'sql_select') {
    // For sql_select, walk selectSegments looking for embedded sources/queries
    if (source.selectSegments) {
      for (const segment of source.selectSegments) {
        walkSegment(segment);
      }
    }
  }

  return deps;
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
  // Build set of all persist sourceIDs for filtering dependencies
  const persistSourceIds = new Set(
    persistSources.map(s => s.sourceID).filter((id): id is string => !!id)
  );

  // Build dependency map for all persist sources
  const depMap = new Map<string, string[]>();

  for (const source of persistSources) {
    if (!source.sourceID) continue;
    const deps = findSourceDependencies(source, modelDef, persistSourceIds);
    depMap.set(source.sourceID, deps);
  }

  // Topological sort into levels (Kahn's algorithm)
  const levels: SourceBuildGraph = [];
  const remaining = new Set(persistSourceIds);
  const completed = new Set<string>();

  while (remaining.size > 0) {
    // Find all nodes with no unmet dependencies
    const level: SourceBuildNode[] = [];
    for (const sourceID of remaining) {
      const deps = depMap.get(sourceID) ?? [];
      const unmetDeps = deps.filter(dep => !completed.has(dep));
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

// =============================================================================
// Legacy query-based graph building (kept for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use buildSourceGraph for source-based persistence
 */
export function buildInternalGraph(
  persistQueryNames: string[],
  modelDef: ModelDef
): SourceBuildGraph {
  // Build dependency map for all persist queries
  const depMap = new Map<string, string[]>();
  const persistSet = new Set(persistQueryNames);

  for (const name of persistQueryNames) {
    const query = resolveQuery(modelDef, name);
    if (query) {
      // Find all query dependencies, then filter to only persist ones
      const allDeps = findQueryDependencies(query, modelDef);
      const persistDeps = allDeps.filter(dep => persistSet.has(dep));
      depMap.set(name, persistDeps);
    }
  }

  // Topological sort into levels (Kahn's algorithm)
  const levels: Array<Array<{name: string; dependsOn: string[]}>> = [];
  const remaining = new Set(persistQueryNames);
  const completed = new Set<string>();

  while (remaining.size > 0) {
    const level: Array<{name: string; dependsOn: string[]}> = [];
    for (const name of remaining) {
      const deps = depMap.get(name) ?? [];
      const unmetDeps = deps.filter(dep => !completed.has(dep));
      if (unmetDeps.length === 0) {
        level.push({name, dependsOn: deps});
      }
    }

    if (level.length === 0 && remaining.size > 0) {
      throw new Error(
        `Cycle detected in persist dependencies: ${[...remaining].join(', ')}`
      );
    }

    levels.push(level);
    for (const node of level) {
      remaining.delete(node.name);
      completed.add(node.name);
    }
  }

  // Convert to SourceBuildGraph format (using name as sourceID for legacy compat)
  return levels.map(level =>
    level.map(node => ({sourceID: node.name, dependsOn: node.dependsOn}))
  );
}

function resolveQuery(modelDef: ModelDef, name: string): Query | undefined {
  const obj = modelDef.contents[name];
  return obj?.type === 'query' ? (obj as Query) : undefined;
}

function findQueryDependencies(query: Query, modelDef: ModelDef): string[] {
  const deps: string[] = [];
  const visited = new Set<string>();

  function addDep(name: string) {
    if (!visited.has(name)) {
      visited.add(name);
      deps.push(name);
    }
  }

  function resolveStructRef(ref: StructRef): SourceDef | undefined {
    if (typeof ref === 'string') {
      return resolveSource(modelDef, ref);
    }
    return isSourceDef(ref) ? ref : undefined;
  }

  function walkSource(source: SourceDef) {
    if (source.type === 'query_source') {
      const innerQuery = source.query;
      if (innerQuery.name) {
        addDep(innerQuery.name);
      }
      walkQuery(innerQuery);
    }
    for (const field of source.fields) {
      walkField(field);
    }
  }

  function walkField(field: FieldDef) {
    if (isJoined(field)) {
      if (field.type === 'query_source') {
        const joinedQuerySource = field as SourceDef & {
          type: 'query_source';
          query: Query;
        };
        const innerQuery = joinedQuerySource.query;
        if (innerQuery.name) {
          addDep(innerQuery.name);
        }
        walkQuery(innerQuery);
      }
      if ('fields' in field) {
        for (const subField of field.fields as FieldDef[]) {
          walkField(subField);
        }
      }
    }
  }

  function walkQuery(q: Query) {
    const source = resolveStructRef(q.structRef);
    if (source) {
      walkSource(source);
    }
    for (const segment of q.pipeline) {
      if (
        segment.type === 'reduce' ||
        segment.type === 'project' ||
        segment.type === 'partial'
      ) {
        const querySegment = segment as QuerySegment;
        if (querySegment.extendSource) {
          for (const extField of querySegment.extendSource) {
            walkField(extField);
          }
        }
      }
    }
  }

  walkQuery(query);
  return deps;
}
