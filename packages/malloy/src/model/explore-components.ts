/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {isJoined} from '.';
import type {
  CompositeSourceDef,
  SQLSourceDef,
  TableSourceDef,
  StructDef,
  QuerySourceDef,
} from '.';

/**
 * For the getExploreInfo, these are the types of sources which might have information
 */
type ComponentSourceDef = TableSourceDef | SQLSourceDef | QuerySourceDef;
import type {Model} from '../malloy';
import {PreparedQuery} from '../malloy';

/**
 * Information about a source (table or SQL query) used in a model
 */
export type ExploreComponentInfo =
  | {type: 'table'; tableName: string; sourceID: string}
  | {type: 'sql'; selectStatement: string; sourceID: string};

/**
 * Type guard to check if a structure definition is a queryable source
 * (table, SQL select, or query source)
 */
export function isExploreComponent(
  source: StructDef
): source is ComponentSourceDef {
  return (
    source.type === 'table' ||
    source.type === 'sql_select' ||
    source.type === 'query_source'
  );
}

/**
 * Get information about an explore in a model, including all its sources and joins
 *
 * @param model The model containing the explore
 * @param exploreName The name of the explore to get information for
 * @returns Array of information about all sources used in the explore
 */
export function getExploreComponents(
  model: Model,
  exploreName: string
): ExploreComponentInfo[] {
  const explore = model.getExploreByName(exploreName);

  // Get all sources including potential duplicates
  const allSources = getComponents(explore.structDef, model);

  // Deduplicate sources using sourceID as the key
  const uniqueSources: Record<string, ExploreComponentInfo> = {};
  for (const source of allSources) {
    uniqueSources[source.sourceID] = source;
  }

  // Return the deduplicated sources as an array
  return Object.values(uniqueSources);
}

/**
 * Get information about all sources used in a StructDef, including joins and composite sources
 *
 * @param structDef The structure definition to get information for
 * @param model Optional model reference needed for processing QuerySourceDef
 * @returns Array of information about all sources used in the structure
 */
export function getComponents(
  structDef: StructDef,
  model?: Model
): ExploreComponentInfo[] {
  const sources: ExploreComponentInfo[] = [];

  // Add the main source if it's a queryable source definition
  if (isExploreComponent(structDef)) {
    sources.push(createExploreComponentInfo(structDef, model));
  }

  // Handle composite sources
  if (structDef.type === 'composite') {
    const compositeDef = structDef as CompositeSourceDef;
    for (const source of compositeDef.sources) {
      sources.push(...getComponents(source, model));
    }
  }

  // Process all fields to find joins
  if (structDef.fields) {
    for (const field of structDef.fields) {
      if (isJoined(field)) {
        // Add join source info if it's a queryable source
        if (isExploreComponent(field)) {
          sources.push(createExploreComponentInfo(field, model));
        }

        // Recursively process the join's fields to find nested joins
        if (field.fields && field.fields.length > 0) {
          // Process each field in the join separately
          for (const nestedField of field.fields) {
            if (isJoined(nestedField)) {
              if (isExploreComponent(nestedField)) {
                sources.push(createExploreComponentInfo(nestedField, model));
              }

              // Get nested sources recursively
              sources.push(...getComponents(nestedField, model));
            }
          }
        }
      }
    }
  }

  return sources;
}

/**
 * Create a SourceInfo object from a queryable source definition
 *
 * @param sourceDef The source definition to create a SourceInfo for
 * @param model Optional model reference needed for processing QuerySourceDef
 * @returns A SourceInfo object
 */
function createExploreComponentInfo(
  sourceDef: ComponentSourceDef,
  model?: Model
): ExploreComponentInfo {
  if (sourceDef.type === 'table') {
    // Generate sourceID based on connection and table name
    const sourceID = `${sourceDef.connection}:${sourceDef.tablePath}`;

    return {
      type: 'table',
      tableName: sourceDef.tablePath,
      sourceID: sourceID,
    };
  } else if (sourceDef.type === 'sql_select') {
    // Generate sourceID based on connection and SQL statement
    const sourceID = `${sourceDef.connection}:${sourceDef.selectStr}`;

    return {
      type: 'sql',
      selectStatement: sourceDef.selectStr,
      sourceID: sourceID,
    };
  } else if (sourceDef.type === 'query_source') {
    // Handle QuerySourceDef by compiling the query to SQL
    if (!model) {
      throw new Error('Model is required to process QuerySourceDef');
    }

    // For QuerySourceDef, we need to extract the SQL from the query
    // We need to create a PreparedQuery from the query, then get a PreparedResult
    // to access the SQL
    let sql: string;
    try {
      // Create a PreparedQuery from the query in the QuerySourceDef
      const preparedQuery = new PreparedQuery(
        sourceDef.query,
        model._modelDef,
        []
      );

      // Get the PreparedResult which contains the SQL
      const preparedResult = preparedQuery.getPreparedResult();

      // Extract the SQL
      sql = preparedResult.sql;
    } catch (error) {
      // If we can't compile the query, use a placeholder
      sql = `-- Could not compile SQL for query ${
        sourceDef.query.name || 'unnamed query'
      }: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Generate sourceID based on connection and SQL
    const sourceID = `${sourceDef.connection}:query`;

    return {
      type: 'sql',
      selectStatement: sql,
      sourceID: sourceID,
    };
  } else {
    // This should never happen due to the type guard, but TypeScript needs it
    // Use unknown instead of any to satisfy eslint
    const unknownSource = sourceDef as unknown;
    throw new Error(
      `Unsupported source type: ${String(
        (unknownSource as {type: string}).type
      )}`
    );
  }
}
