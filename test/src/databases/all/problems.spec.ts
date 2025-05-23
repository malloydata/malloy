/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import '../../util/db-jest-matchers';

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
  it(`properly quotes nested field names in ${databaseName}`, async () => {
    const one = runtime.dialect.sqlMaybeQuoteIdentifier('one');
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
      }`).matchesRows(runtime, {
      foo: [{'one': 1, '#': 1, 'deepfoo': [{'one': 1, '#': 1}]}],
    });
  });

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
