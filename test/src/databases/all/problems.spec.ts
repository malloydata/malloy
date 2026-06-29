/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '@malloydata/malloy/test/matchers';
import {wrapTestModel} from '@malloydata/malloy/test';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

afterAll(async () => {
  await runtimes.closeAll();
});

async function getError<T>(fn: () => Promise<T>) {
  try {
    await fn();
  } catch (error) {
    return error;
  }
}

runtimes.runtimeMap.forEach((runtime, databaseName) => {
  const testModel = wrapTestModel(runtime, '');
  it.when(runtime.supportsNesting)(
    `properly quotes nested field names in ${databaseName}`,
    async () => {
      const one = runtime.dialect.sqlQuoteIdentifier('one');
      await expect(`
      run: ${databaseName}.sql(""" SELECT 1 as ${one} """) -> {
        nest: foo is {
          group_by: one
          aggregate: \`#\` is count(one)
          nest: deepfoo is {
            group_by: one
            aggregate: \`#\` is count(one)
          }
        }
      }`).toMatchResult(testModel, {
        foo: [{'one': 1, '#': 1, 'deepfoo': [{'one': 1, '#': 1}]}],
      });
    }
  );

  describe('warnings', () => {
    // NOTE: This test generates SQL errors on the console because of
    // a hard-coded console.log() in the duckdb-wasm worker
    it(`can appear after errors - ${databaseName}`, async () => {
      const source = `
        source: foo is ${databaseName}.table('asdfds');
        source: bar is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: a is LENGTH('foo')
        }
      `;
      const model = await runtime.getModel(source, {noThrowOnError: true});
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
    it(`can appear before errors - ${databaseName}`, async () => {
      const source = `
        source: bar is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: a is LENGTH('foo')
        }
        source: foo is ${databaseName}.table('asdfds');
      `;
      const error = await getError(() => runtime.getModel(source));
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

    it(`can appear alone - ${databaseName}`, async () => {
      const source = `
        source: bar is ${databaseName}.table('malloytest.state_facts') extend {
          dimension: a is LENGTH('foo')
        }
      `;
      const model = await runtime.getModel(source);
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
});
