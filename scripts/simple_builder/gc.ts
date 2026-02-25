/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {readFile, readdir, writeFile} from 'fs/promises';
import * as path from 'path';
import type {Log, GCLog, GCLogEntry} from './log_types';
import {logFileName} from './log_types';

/**
 * Read all logs in a directory and compute DROP TABLE statements for
 * tables that were created but are no longer referenced by the most
 * recent build. Writes a GC log so subsequent runs skip already-dropped
 * tables.
 */
export async function gc(logDirPath: string, sqlPath: string): Promise<void> {
  // Read all JSON log files, sorted by filename (chronological)
  const files = (await readdir(logDirPath))
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log('No log files found, nothing to do.');
    return;
  }

  const logs: Log[] = [];
  for (const file of files) {
    const contents = await readFile(path.join(logDirPath, file), 'utf-8');
    logs.push(JSON.parse(contents) as Log);
  }

  // Walk all logs chronologically to find:
  // - tables that currently exist (built and not yet dropped)
  // - tables referenced by the last build
  const liveTablesByBuildId = new Map<string, string>();
  let lastBuildReferences = new Set<string>();

  for (const log of logs) {
    if (log.type === 'build') {
      lastBuildReferences = new Set<string>();
      for (const entry of log.entries) {
        lastBuildReferences.add(entry.buildId);
        if (entry.action === 'built') {
          liveTablesByBuildId.set(entry.buildId, entry.tableName);
        }
      }
    } else if (log.type === 'gc') {
      for (const entry of log.entries) {
        if (entry.action === 'dropped') {
          liveTablesByBuildId.delete(entry.buildId);
        }
      }
    }
  }

  // Tables to drop: live (built and not dropped) but not in the last build
  const toDrop: Array<{buildId: string; tableName: string}> = [];
  for (const [buildId, tableName] of liveTablesByBuildId) {
    if (!lastBuildReferences.has(buildId)) {
      toDrop.push({buildId, tableName});
    }
  }

  if (toDrop.length === 0) {
    console.log('No orphaned tables to drop.');
    return;
  }

  console.log(`Found ${toDrop.length} orphaned table(s) to drop:`);

  const sqlStatements: string[] = [];
  const gcEntries: GCLogEntry[] = [];
  const now = new Date();

  for (const {buildId, tableName} of toDrop) {
    if (/[;'"\\]/.test(tableName)) {
      throw new Error(
        `Unsafe table name "${tableName}": must not contain ; ' " or \\`
      );
    }
    console.log(`  DROP TABLE ${tableName} (${buildId})`);
    sqlStatements.push(`DROP TABLE IF EXISTS ${tableName};`);
    gcEntries.push({action: 'dropped', buildId, tableName});
  }

  // Write SQL file
  await writeFile(sqlPath, sqlStatements.join('\n') + '\n');
  console.log(`\nWrote SQL: ${sqlPath}`);

  // Write GC log
  const gcLog: GCLog = {
    type: 'gc',
    startedAt: now.toISOString(),
    endedAt: new Date().toISOString(),
    entries: gcEntries,
  };
  const gcLogPath = path.join(logDirPath, logFileName('gc', now));
  await writeFile(gcLogPath, JSON.stringify(gcLog, null, 2));
  console.log(`Wrote GC log: ${gcLogPath}`);
}
