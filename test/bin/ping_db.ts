/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

import {runtimeFor} from '../src/runtimes';

const main = async () => {
  if (process.argv.length < 3) {
    console.info(`usage ${process.argv[1]} [database]`);
    process.exit(1);
  }
  const runtime = runtimeFor(process.argv[2]);
  try {
    await runtime.connection.runSQL('SELECT 1');
    console.log('Success');
  } catch (e) {
    console.error('Failed', e.toString());
    process.exit(1);
  }
};

main();
