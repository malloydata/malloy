/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// `npm test [jest args]` runs core, plus everything selected for
// MALLOY_DATABASE, ignoring dbAllPassing and dbAllSkip.
//
// `npm run dbtest NAME [jest args]` runs exactly what NAME's CI job runs: its
// connection tests, its `db-NAME` and set files, and its `db-all` files,
// narrowed by `dbAllPassing` and `dbAllSkip`.
//
// Both put the jest args first, since `--selectProjects` takes every word
// after it, a file path included.

import {spawnSync} from 'child_process';
import {databases} from '../test/src/databases';

const CORE_PROJECTS = ['core', 'malloy-render-test', 'malloy-render'];

function jest(projects: string[], jestArgs: string[], env: NodeJS.ProcessEnv) {
  const run = spawnSync(
    'npx',
    ['jest', ...jestArgs, '--selectProjects', ...projects],
    {stdio: 'inherit', env}
  );
  process.exit(run.status ?? 1);
}

const [mode, ...args] = process.argv.slice(2);
const names = Object.keys(databases);

if (mode === 'test') {
  const selected = process.env['MALLOY_DATABASE'];
  jest(
    selected ? [...CORE_PROJECTS, selected] : CORE_PROJECTS,
    args,
    process.env
  );
} else if (mode === 'dbtest') {
  const [name, ...jestArgs] = args;
  if (name === undefined || !names.includes(name)) {
    console.error(
      `${name === undefined ? 'No database given' : `"${name}" is not a database`}.` +
        `\nUsage: npm run dbtest NAME, where NAME is one of: ${names.join(', ')}`
    );
    process.exit(1);
  }
  jest([name], [...jestArgs, '--reporters', 'agent'], {
    ...process.env,
    MALLOY_DATABASE: name,
    MALLOY_DBTEST: '1',
  });
} else {
  console.error('Usage: jest_select.ts test|dbtest [...]');
  process.exit(1);
}
