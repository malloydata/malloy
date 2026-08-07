/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * SourceDef Utilities for Persistence
 *
 * Key invariant: a source's identity fields (sourceID, referenceID, extends)
 * are assigned in the translator (DefineSource / the reference path), never by
 * these compiler factories. The factory functions explicitly copy only the
 * fields they need, never using spread, so identity is not propagated onto a
 * freshly built source.
 */

import type {
  BuildID,
  FieldDef,
  GivenID,
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
import {makeDigest, pathToKey} from './utils';
import {
  isSourceDef,
  isPersistableSourceDef,
  isSourceRegistryReference,
  safeRecordGet,
} from './malloy_types';

export function mkSourceID(name: string, url: string | undefined): SourceID {
  return `${name}@${url ?? 'unknown'}`;
}

export function mkGivenID(name: string, url: string | undefined): GivenID {
  return pathToKey('given', [name, url ?? 'unknown']);
}

/**
 * Create a BuildID from connection digest and SQL.
 * BuildID is a hash that uniquely identifies a build artifact.
 */
export function mkBuildID(connectionDigest: string, sql: string): BuildID {
  return makeDigest(connectionDigest, sql);
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
    annotations: base.annotations,
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

    // Identity fields - explicitly NOT copied
    // sourceID: undefined,
    // referenceID: undefined,
    // extends: undefined,
    // persistent: undefined,
    // persistDeclared: undefined,
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
    annotations: base.annotations,
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

    // Identity fields - explicitly NOT copied
    // sourceID: undefined,
    // referenceID: undefined,
    // extends: undefined,
    // persistent: undefined,
    // persistDeclared: undefined,
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
 * Resolve a SourceID (a source's own `sourceID`, or a `referenceID` pointing at
 * one) to its SourceDef using the sourceRegistry, returning any kind of source.
 *
 * @param modelDef The model definition containing the registry
 * @param sourceID The SourceID to resolve
 * @returns The SourceDef if found, undefined otherwise
 */
export function resolveSourceRef(
  modelDef: ModelDef,
  sourceID: SourceID
): SourceDef | undefined {
  const value = modelDef.sourceRegistry[sourceID];
  if (!value) return undefined;

  if (isSourceRegistryReference(value.entry)) {
    const obj = safeRecordGet(modelDef.contents, value.entry.name);
    return obj && isSourceDef(obj) ? obj : undefined;
  }

  return value.entry;
}

/**
 * Resolve a sourceID to a persistable SourceDef using the sourceRegistry.
 *
 * @param modelDef The model definition containing the registry
 * @param sourceID The sourceID to resolve
 * @returns The PersistableSourceDef if found, undefined otherwise
 */
export function resolveSourceID(
  modelDef: ModelDef,
  sourceID: SourceID
): PersistableSourceDef | undefined {
  const sd = resolveSourceRef(modelDef, sourceID);
  return sd && isPersistableSourceDef(sd) ? sd : undefined;
}

/** The namespace entry a source refers to (see `sourceNamespaceReference`). */
export interface NamespaceReference {
  /** The name this source is bound to in `modelDef.contents`. */
  name: string;
  /** The referenced source. */
  source: SourceDef;
}

/**
 * If `sd` was created as an unmodified reference to another source
 * (`sd.referenceID` is set) and that source is present in this model's
 * namespace, return it together with the name it goes by. Returns undefined
 * when `sd` defines its own shape, or when the referenced source is not in this
 * model's namespace (e.g. an imported source whose own target wasn't imported).
 */
export function sourceNamespaceReference(
  modelDef: ModelDef,
  sd: SourceDef
): NamespaceReference | undefined {
  if (sd.referenceID === undefined) return undefined;
  const value = modelDef.sourceRegistry[sd.referenceID];
  if (!value || !isSourceRegistryReference(value.entry)) return undefined;
  const name = value.entry.name;
  const source = safeRecordGet(modelDef.contents, name);
  return source && isSourceDef(source) ? {name, source} : undefined;
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
