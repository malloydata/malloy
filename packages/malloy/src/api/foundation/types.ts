/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {EventStream} from '../../runtime_types';
import type {BuildManifest} from '../../model';

export type {Taggable} from '../../taggable';

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
}

/** Options for how to run the Malloy semantic checker/translator */
export interface CompileOptions {
  refreshSchemaCache?: boolean | number;
  noThrowOnError?: boolean;
}

/** Options given to the Malloy compiler (QueryModel) */
export interface CompileQueryOptions {
  eventStream?: EventStream;
  defaultRowLimit?: number;
  /** Manifest of built tables for persist query substitution */
  buildManifest?: BuildManifest;
  /** If true, throw when a persist query's digest is not in the manifest */
  strictPersist?: boolean;
}

// =============================================================================
// Build Graph Types (for persistence)
// =============================================================================

/**
 * A node in the build graph.
 * Uses sourceId (sourceName@modelURL) for identity.
 */
export interface BuildNode {
  /** Source identity: "sourceName@modelURL" */
  sourceId: string;
  /** Dependencies (other sourceIds) that must be built first */
  dependsOn: string[];
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
