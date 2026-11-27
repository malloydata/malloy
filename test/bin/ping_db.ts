/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */

import {testDatabaseNamed} from '../src/test_database';

const main = async () => {
  if (process.argv.length < 3) {
    console.info(`usage ${process.argv[1]} [database]`);
    process.exit(1);
  }
  const database = testDatabaseNamed(process.argv[2]);
  try {
    await (await database.connection()).runSQL('SELECT 1');
    await database.shutdown();
    console.log('Success');
  } catch (e) {
    console.error('Failed', e.toString());
    process.exit(1);
  }
};

main();
