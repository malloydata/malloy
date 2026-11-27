/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

async function getError<T>(fn: () => Promise<T>) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
}

describe('warnings', () => {
  // NOTE: This test generates SQL errors on the console because of
  // a hard-coded console.log() in the duckdb-wasm worker
  it('can appear after errors', async () => {
    const source = `
        source: foo is db.table('asdfds');
        source: bar is db.table('malloytest.state_facts') extend {
          dimension: a is LENGTH('foo')
        }
      `;
    const model = await testDatabase.runtime.getModel(source, {
      noThrowOnError: true,
    });
    expect(model).toMatchObject({
      problems: [
        {
          severity: 'error',
        },
        {
          message:
            "Case insensitivity for function names is deprecated, use 'length' instead",
          severity: 'warn',
        },
      ],
    });
  });

  // NOTE: This test generates SQL errors on the console because of
  // a hard-coded console.log() in the duckdb-wasm worker
  it('can appear before errors', async () => {
    const source = `
        source: bar is db.table('malloytest.state_facts') extend {
          dimension: a is LENGTH('foo')
        }
        source: foo is db.table('asdfds');
      `;
    const error = await getError(() => testDatabase.runtime.getModel(source));
    expect(error).not.toBeUndefined();
    expect(error).toMatchObject({
      problems: [
        {
          message:
            "Case insensitivity for function names is deprecated, use 'length' instead",
          severity: 'warn',
        },
        {
          severity: 'error',
        },
      ],
    });
  });

  it('can appear alone', async () => {
    const source = `
        source: bar is db.table('malloytest.state_facts') extend {
          dimension: a is LENGTH('foo')
        }
      `;
    const model = await testDatabase.runtime.getModel(source);
    expect(model).toMatchObject({
      problems: [
        {
          message:
            "Case insensitivity for function names is deprecated, use 'length' instead",
          severity: 'warn',
        },
      ],
    });
  });
});
