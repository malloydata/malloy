/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * SourceDef Utilities for Persistence
 *
 * Key invariant: sourceID is ONLY assigned in DefineSource when a source
 * gets a name. Factory functions explicitly copy only the fields they need,
 * never using spread, to prevent accidental propagation of sourceID/extends.
 *
 * The `extends` property is set by callers when processing extend blocks.
 */

import type {
  FieldDef,
  ModelDef,
  PersistableSourceDef,
  Query,
  QuerySourceDef,
  SourceDef,
  SourceID,
  SourceRegistryEntry,
  SourceRegistryValue,
  SQLPhraseSegment,
  SQLSourceDef,
  TableSourceDef,
} from './malloy_types';
import {
  isSourceDef,
  isPersistableSourceDef,
  isSourceRegistryReference,
} from './malloy_types';

export function mkSourceID(name: string, url: string | undefined): SourceID {
  return `${name}@${url ?? 'unknown'}`;
}

/**
 * Create a QuerySourceDef from query compilation output.
 * Explicitly copies SourceDefBase fields - no spread.
 */
export function mkQuerySourceDef(
  base: SourceDef,
  query: Query,
  name: string
): QuerySourceDef {
  return {
    // Type discriminant
    type: 'query_source',

    // QuerySourceDef-specific
    query,

    // NamedObject
    name,
    as: base.as,

    // HasLocation
    location: base.location,

    // StructDefBase
    annotation: base.annotation,
    modelAnnotation: base.modelAnnotation,
    fields: base.fields,

    // Filtered
    filterList: base.filterList,

    // ResultStructMetadata
    resultMetadata: base.resultMetadata,

    // SourceDefBase
    arguments: query.sourceArguments,
    parameters: base.parameters,
    queryTimezone: base.queryTimezone,
    connection: base.connection,
    primaryKey: base.primaryKey,
    dialect: base.dialect,
    partitionComposite: base.partitionComposite,
    errorFactory: base.errorFactory,

    // PersistableSourceProperties - explicitly NOT copied
    // sourceID: undefined,
    // extends: undefined,
  };
}

/**
 * Create an SQLSourceDef from schema lookup result.
 * Explicitly copies SourceDefBase fields - no spread.
 */
export function mkSQLSourceDef(
  base: SourceDef,
  selectStr: string,
  selectSegments?: SQLPhraseSegment[]
): SQLSourceDef {
  return {
    // Type discriminant
    type: 'sql_select',

    // SQLSourceDef-specific
    selectStr,
    selectSegments,

    // NamedObject
    name: base.name,
    as: base.as,

    // HasLocation
    location: base.location,

    // StructDefBase
    annotation: base.annotation,
    modelAnnotation: base.modelAnnotation,
    fields: base.fields,

    // Filtered
    filterList: base.filterList,

    // ResultStructMetadata
    resultMetadata: base.resultMetadata,

    // SourceDefBase
    arguments: base.arguments,
    parameters: base.parameters,
    queryTimezone: base.queryTimezone,
    connection: base.connection,
    primaryKey: base.primaryKey,
    dialect: base.dialect,
    partitionComposite: base.partitionComposite,
    errorFactory: base.errorFactory,

    // PersistableSourceProperties - explicitly NOT copied
    // sourceID: undefined,
    // extends: undefined,
  };
}

/**
 * Create a TableSourceDef. All fields specified, no base to copy from.
 */
export function mkTableSourceDef(
  name: string,
  connection: string,
  tablePath: string,
  dialect: string,
  fields: FieldDef[]
): TableSourceDef {
  return {
    type: 'table',
    name,
    connection,
    tablePath,
    dialect,
    fields,
  };
}

// =============================================================================
// Source Registry Utilities
// =============================================================================

/**
 * Resolve a sourceID to a SourceDef using the sourceRegistry.
 *
 * @param modelDef The model definition containing the registry
 * @param sourceID The sourceID to resolve
 * @returns The SourceDef if found, undefined otherwise
 */
export function resolveSourceID(
  modelDef: ModelDef,
  sourceID: SourceID
): PersistableSourceDef | undefined {
  const value = modelDef.sourceRegistry[sourceID];
  if (!value) return undefined;

  if (isSourceRegistryReference(value.entry)) {
    const obj = modelDef.contents[value.entry.name];
    return obj && isSourceDef(obj) && isPersistableSourceDef(obj)
      ? obj
      : undefined;
  }

  // It's a PersistableSourceDef
  return value.entry;
}

/**
 * Add an entry to the sourceRegistry.
 *
 * @param registry The sourceRegistry to modify (from ModelDef or Document)
 * @param sourceID The sourceID to register
 * @param entry Either a SourceRegistryReference (for namespace sources) or a PersistableSourceDef (for hidden deps)
 */
export function registerSource(
  registry: Record<SourceID, SourceRegistryValue>,
  sourceID: SourceID,
  entry: SourceRegistryEntry
): void {
  registry[sourceID] = {entry};
}

/**
 * Check if a sourceID is already in the registry.
 */
export function hasSourceRegistryEntry(
  modelDef: ModelDef,
  sourceID: SourceID
): boolean {
  return sourceID in modelDef.sourceRegistry;
}
