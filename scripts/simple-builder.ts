/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable n/no-process-exit */

/**
 * Simple builder for testing the source persist API.
 *
 * Usage:
 *   npx ts-node scripts/simple-builder.ts build <model.malloy> -m <manifest.json> -s <output.sql> -l <logdir>
 *   npx ts-node scripts/simple-builder.ts gc -l <logdir> -s <output.sql>
 */

import * as path from 'path';
import {build} from './simple_builder/build';
import {gc} from './simple_builder/gc';

function parseFlag(args: string[], ...flags: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i])) return args[i + 1];
  }
  return undefined;
}

function positional(args: string[]): string | undefined {
  for (const arg of args) {
    if (!arg.startsWith('-')) return arg;
  }
  return undefined;
}

function requireArg(
  value: string | undefined,
  name: string,
  usage: string
): string {
  if (!value) {
    console.error(`Error: ${name} is required`);
    console.error(usage);
    process.exit(1);
  }
  return value;
}

const USAGE_BUILD =
  'Usage: simple-builder build <model.malloy> -m <manifest.json> -s <output.sql> -l <logdir>';
const USAGE_GC = 'Usage: simple-builder gc -l <logdir> -s <output.sql>';
const USAGE =
  'Usage: simple-builder <build|gc> [options]\n\n' +
  USAGE_BUILD +
  '\n' +
  USAGE_GC;

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (command === 'build') {
    const modelFile = requireArg(positional(args), 'Model file', USAGE_BUILD);
    const manifestFile = requireArg(
      parseFlag(args, '-m', '--manifest'),
      'Manifest file (-m)',
      USAGE_BUILD
    );
    const sqlFile = requireArg(
      parseFlag(args, '-s', '--sql'),
      'SQL output file (-s)',
      USAGE_BUILD
    );
    const logDir = requireArg(
      parseFlag(args, '-l', '--log-dir'),
      'Log directory (-l)',
      USAGE_BUILD
    );

    await build({
      modelFile: path.resolve(modelFile),
      manifestFile: path.resolve(manifestFile),
      sqlFile: path.resolve(sqlFile),
      logDir: path.resolve(logDir),
    });
  } else if (command === 'gc') {
    const sqlFile = requireArg(
      parseFlag(args, '-s', '--sql'),
      'SQL output file (-s)',
      USAGE_GC
    );
    const logDir = requireArg(
      parseFlag(args, '-l', '--log-dir'),
      'Log directory (-l)',
      USAGE_GC
    );

    await gc(path.resolve(logDir), path.resolve(sqlFile));
  } else {
    console.error(
      command ? `Unknown command: ${command}` : 'No command specified'
    );
    console.error(USAGE);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
