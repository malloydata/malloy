/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  FieldDef,
  ModelDef,
  Query,
  QuerySegment,
  SourceDef,
  StructRef,
} from './malloy_types';
import {isJoined, isSourceDef} from './malloy_types';

/**
 * A node in the internal (model-layer) build graph.
 * Uses query names only - digests are computed later in the API layer.
 */
export interface InternalBuildNode {
  name: string;
  dependsOn: string[];
}

/**
 * Internal build graph: leveled array for parallel execution.
 * Queries in the same level can be built in parallel.
 */
export type InternalBuildGraph = InternalBuildNode[][];

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
 * Resolve a query name to its definition from model contents.
 */
function resolveQuery(modelDef: ModelDef, name: string): Query | undefined {
  const obj = modelDef.contents[name];
  return obj?.type === 'query' ? (obj as Query) : undefined;
}

/**
 * Find all named query dependencies for a query.
 *
 * Walks the query structure looking for:
 * 1. Source is a query_source
 * 2. Joins that are query_source
 * 3. extendSource in pipeline segments containing query joins
 *
 * @returns Array of dependency query names (all named queries, not filtered by persist)
 */
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
    // Check if source is a query_source
    if (source.type === 'query_source') {
      const innerQuery = source.query;
      if (innerQuery.name) {
        addDep(innerQuery.name);
      }
      // Recursively walk the inner query
      walkQuery(innerQuery);
    }

    // Walk all fields looking for joins
    for (const field of source.fields) {
      walkField(field);
    }
  }

  function walkField(field: FieldDef) {
    // Check if this is a joined source
    if (isJoined(field)) {
      // It's a JoinFieldDef - check if it's a query_source
      if (field.type === 'query_source') {
        const joinedQuerySource = field as SourceDef & {
          type: 'query_source';
          query: Query;
        };
        const innerQuery = joinedQuerySource.query;
        if (innerQuery.name) {
          addDep(innerQuery.name);
        }
        // Recursively walk the joined query
        walkQuery(innerQuery);
      }
      // Walk fields of any joined source
      if ('fields' in field) {
        for (const subField of field.fields as FieldDef[]) {
          walkField(subField);
        }
      }
    }
  }

  function walkQuery(q: Query) {
    // Resolve and walk the query's source
    const source = resolveStructRef(q.structRef);
    if (source) {
      walkSource(source);
    }

    // Walk pipeline segments for extendSource
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

  // Start walking from the root query
  walkQuery(query);

  return deps;
}

/**
 * Build an internal build graph from persist query names.
 *
 * Performs topological sort to order queries by dependencies.
 * Returns a leveled array where queries in the same level can be built in parallel.
 *
 * @param persistQueryNames Names of all queries marked with #@ persist
 * @param modelDef The model definition containing queries and sources
 * @returns Leveled build graph
 */
export function buildInternalGraph(
  persistQueryNames: string[],
  modelDef: ModelDef
): InternalBuildGraph {
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
  const levels: InternalBuildGraph = [];
  const remaining = new Set(persistQueryNames);
  const completed = new Set<string>();

  while (remaining.size > 0) {
    // Find all nodes with no unmet dependencies
    const level: InternalBuildNode[] = [];
    for (const name of remaining) {
      const deps = depMap.get(name) ?? [];
      const unmetDeps = deps.filter(dep => !completed.has(dep));
      if (unmetDeps.length === 0) {
        level.push({
          name,
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
      remaining.delete(node.name);
      completed.add(node.name);
    }
  }

  return levels;
}
