/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {EventStream} from '../../runtime_types';
import type {BuildID, BuildManifest, GivenValue, VirtualMap} from '../../model';
import type {LogMessage} from '../../lang';
import type {PersistSource} from './core';

/**
 * An empty BuildManifest with no entries and strict mode off.
 * Use this to explicitly suppress manifest substitution in a query:
 *
 *   runtime.loadQuery(url, {buildManifest: EMPTY_BUILD_MANIFEST}).getSQL()
 *
 * Frozen to prevent accidental mutation of the shared sentinel.
 */
export const EMPTY_BUILD_MANIFEST: BuildManifest = Object.freeze({
  entries: Object.freeze({}),
  strict: false,
});

export type {Taggable} from './taggable';

export interface Loggable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message?: any, ...optionalParams: any[]) => void;
}

export interface ParseOptions {
  importBaseURL?: URL;
  testEnvironment?: boolean;
  /** Reject language constructs that reach outside the trusted model. */
  restrictedMode?: boolean;
  /**
   * Diagnostic label for the synthetic URL minted when compiling inline
   * source that has no URL of its own: `internal://<method>/<uuid>`. Each
   * such compile still gets a unique id regardless; this just makes the
   * originating operation legible in error locations and annotation
   * provenance. Read solely to build that URL — never branched on.
   */
  method?: CompileMethod;
}

/**
 * The operation behind a URL-less (inline-source) compile, used only to
 * label its synthetic `internal://` URL. `query` covers both the stable
 * query-compile path and `loadRestrictedQuery`; `loadQuery` is a `loadModel`
 * under the hood and carries that label.
 */
export type CompileMethod = 'loadModel' | 'extendModel' | 'query';

/** Options for how to run the Malloy semantic checker/translator */
export interface CompileOptions {
  refreshSchemaCache?: boolean | number;
  noThrowOnError?: boolean;
}

/** Options given to the Malloy compiler (QueryModel) */
export interface CompileQueryOptions {
  eventStream?: EventStream;
  defaultRowLimit?: number;
  /** Manifest of built tables for persist source substitution */
  buildManifest?: BuildManifest;
  /** Map from connectionName to connectionDigest (from Connection.getDigest()) */
  connectionDigests?: Record<string, string>;
  /** Map from connectionName → virtualName → tablePath for virtual source resolution */
  virtualMap?: VirtualMap;
  givens?: Record<string, GivenValue>;
}

// =============================================================================
// Build Graph Types (for persistence)
// =============================================================================

/**
 * A node in the build graph (recursive DAG structure).
 * Uses sourceID (sourceName@modelURL) for identity.
 *
 * A node reached twice is the *same object* both times, so the graph shares
 * nodes rather than copying them. Anything walking it needs a seen-set on node
 * identity, or a chain of diamonds is exponential.
 *
 * @deprecated Produced only by {@link BuildPlan}. Use `BuildTarget`.
 */
export interface BuildNode {
  /** Source identity: "sourceName@modelURL" */
  sourceID: string;
  /** Dependencies as nested BuildNodes (recursive DAG) */
  dependsOn: BuildNode[];
}

/**
 * An ordered build plan for sources on a single connection.
 *
 * `nodes` is typed for a leveled schedule that was never produced — it always
 * holds exactly one entry, the roots, with the real ordering in each node's
 * `dependsOn`.
 *
 * @deprecated Use `BuildTargets`, which reports tables rather than sources.
 */
export interface BuildGraph {
  /** The connection all sources in this graph run on */
  connectionName: string;
  /** Always one entry: the root nodes */
  nodes: BuildNode[][];
}

/**
 * One artifact: a table to build, and every source that maps onto it.
 *
 * A `BuildNode` is a source; a `BuildTarget` is a table. The two are not the
 * same count. `#@ persist` is an annotation, so extending or renaming a
 * persisted source inherits it — while `extend` never changes the source's
 * SQL — and several sources routinely name one table. The manifest is keyed by
 * `BuildID`, so those sources share one entry no matter how many plan nodes
 * they occupy. `Runtime.getBuildTargets()` does that merge once, in the core,
 * instead of leaving each builder to discover it by hashing.
 */
export interface BuildTarget {
  /** Manifest key for this artifact: a hash of the connection digest and `sql` */
  buildId: BuildID;
  /** The connection this artifact is built on */
  connectionName: string;
  /**
   * The SQL the BuildID is computed from: fully inlined, no manifest
   * substitution, so it is the same string whatever else has been built.
   *
   * It is not the SQL to execute. That one substitutes the tables built so far
   * — `source.getSQL({buildManifest, connectionDigests})` — so it can only be
   * computed as the build walks, and only by the builder holding the manifest.
   */
  sql: string;
  /** Targets that must exist before this one can be built */
  dependsOn: BuildTarget[];
  /** Every persist source in the model that maps onto this artifact */
  sources: PersistSource[];
}

/**
 * Everything one connection has to build.
 *
 * `targets` is in dependency order — everything a target depends on appears
 * before it — so the simplest correct builder is a loop:
 *
 * ```typescript
 * for (const target of targets) await build(target);
 * ```
 *
 * A builder that wants concurrency uses `target.dependsOn` and starts each one
 * the moment its own dependencies finish:
 *
 * ```typescript
 * const done = new Map<BuildTarget, Promise<void>>();
 * for (const target of targets) {
 *   done.set(target, (async () => {
 *     await Promise.all(target.dependsOn.map(d => done.get(d)));
 *     await build(target);
 *   })());
 * }
 * await Promise.all(done.values());
 * ```
 *
 * That is the maximum available: nothing waits for anything it does not read.
 * Batching the targets into rounds instead — everything at depth 0, then
 * everything at depth 1 — is easier to write and strictly worse, because a
 * target then waits on unrelated work that happens to share its depth.
 */
export interface ConnectionBuild {
  /** The connection everything here is built on */
  connectionName: string;
  /** Every table to build, dependencies before dependents */
  targets: BuildTarget[];
}

/**
 * The build schedule for a model.
 *
 * Connections come first because they are the largest cut of parallelism: a
 * query cannot cross a connection, so no dependency ever does either, and each
 * entry here is a wholly independent build that needs no coordination with any
 * other.
 */
export interface BuildTargets {
  /** One per connection, mutually independent */
  connections: ConnectionBuild[];
  /** Errors and warnings from parsing `#@` annotations on persistable sources */
  tagParseLog: LogMessage[];
}
