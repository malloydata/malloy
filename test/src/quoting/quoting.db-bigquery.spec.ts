/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {test} from '@jest/globals';
import type * as malloy from '@malloydata/malloy';

import {testModel} from '../models/faa_model';
import {testDatabase} from '../test_database';
import '@malloydata/malloy/test/matchers';

afterAll(() => testDatabase.shutdown());

async function runQuery(model: malloy.ModelMaterializer, query: string) {
  return await model.loadQuery(query).run();
}

describe('sql injection tests', () => {
  const model = testDatabase.runtime.loadModel(testModel);
  jest.setTimeout(100000);

  test('string literal escapes quotes', async () => {
    const result = await runQuery(
      model,
      `
      run: db.table('malloytest.state_facts')->{ group_by: test is 'foo\\''
      }
    `
    );
    expect(result.data.value[0]['test']).toBe("foo'");
  });

  test('string filter escapes quotes', async () => {
    const result = await runQuery(
      model,
      `
      run: db.table('malloytest.state_facts')->{ aggregate: test is count() { where: state ? 'foo\\'' } }
    `
    );
    expect(result.data.value[0]['test']).toBe(0);
  });

  test('string literal escapes backslashes', async () => {
    const result = await runQuery(
      model,
      `
      run: db.table('malloytest.state_facts')->{ group_by: test is 'foo\\\\\\''
      }
    `
    );
    expect(result.data.value[0]['test']).toBe("foo\\'");
  });

  test('string filter escapes backslashes', async () => {
    const result = await runQuery(
      model,
      `
      run: db.table('malloytest.state_facts')->{ aggregate: test is count() { where: state ? 'foo\\\\\\'' }}
    `
    );
    expect(result.data.value[0]['test']).toBe(0);
  });

  test('comment in string', async () => {
    const result = await runQuery(
      model,
      `
      run: db.table('malloytest.state_facts')->{ group_by: test is 'foo \\\\'--'
      }
    `
    );
    expect(result.data.value[0]['test']).toBe('foo \\');
  });

  test('comment in string filter', async () => {
    let error;
    try {
      await runQuery(
        model,
        `
        run: db.table('malloytest.state_facts')->{ aggregate: test is count() { where: state ? 'foo \\\\' THEN 0 else 1 END) as test--'
        }}      `
      );
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeUndefined();
  });

  test.todo("'malloytest\\'.tables' produces the wrong error...");

  test('comment in literal', async () => {
    const result = await runQuery(
      model,
      `
      run: flights->{ group_by: test is 'foo \\\\'--'
      }
    `
    );
    expect(result.data.value[0]['test']).toBe('foo \\');
  });
});
