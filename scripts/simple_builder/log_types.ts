/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Shared types for build logs and GC logs.
 *
 * A log directory contains timestamped JSON files. Each file is a BuilderLog
 * (from the builder) or a GCLog (from garbage collection). Reading all files
 * in filename order gives a complete history.
 */

export type Log = BuilderLog | GCLog;

export interface BuilderLog {
  type: 'build';
  startedAt: string;
  endedAt: string;
  entries: BuildLogEntry[];
}

export interface GCLog {
  type: 'gc';
  startedAt: string;
  endedAt: string;
  entries: GCLogEntry[];
}

export type BuildLogEntry = BuildLogExists | BuildLogBuilt;

interface BuildLogEntryBase {
  buildId: string;
  tableName: string;
  nameProvided: boolean;
}

export interface BuildLogExists extends BuildLogEntryBase {
  action: 'exists';
}

export interface BuildLogBuilt extends BuildLogEntryBase {
  action: 'built';
  buildStartedAt: string;
  buildEndedAt: string;
}

export interface GCLogEntry {
  action: 'dropped';
  buildId: string;
  tableName: string;
}

/**
 * Generate a log filename from a UTC timestamp.
 * e.g. "build-2026-02-24T18-30-45.123Z.json"
 */
export function logFileName(prefix: string, date: Date): string {
  const ts = date.toISOString().replace(/:/g, '-');
  return `${prefix}-${ts}.json`;
}
