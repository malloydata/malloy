/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {EventStream} from '../../runtime_types';
import type {BuildManifest, GivenValue, VirtualMap} from '../../model';

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
 * The leveled array structure determines build order: sources in the same
 * level can be built in parallel, levels must be built sequentially.
 *
 * Builders can group graphs by `connectionName` to parallelize across
 * different database connections.
 */
export interface BuildGraph {
  /** The connection all sources in this graph run on */
  connectionName: string;
  /** The leveled build nodes */
  nodes: BuildNode[][];
}
