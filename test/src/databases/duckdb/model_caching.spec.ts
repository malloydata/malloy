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

import {describeIfDatabaseAvailable} from '../../util';
import {RuntimeList, TestCacheManager, TestURLReader} from '../../runtimes';

const [_describe, databases] = describeIfDatabaseAvailable(['duckdb']);
const runtimes = new RuntimeList(databases);

describe.each(runtimes.runtimeList)('%s', (databaseName, runtime) => {
  test('model caching works', async () => {
    const cacheManager = runtime.cacheManager;
    const urlReader = runtime.urlReader;
    expect(urlReader instanceof TestURLReader).toBe(true);
    if (!(urlReader instanceof TestURLReader)) return;
    expect(cacheManager instanceof TestCacheManager).toBe(true);
    if (!(cacheManager instanceof TestCacheManager)) return;
    const modelCache = cacheManager._modelCache;
    if (modelCache === undefined) return;
    const aURL = new URL('file://a.malloy');
    const bURL = new URL('file://b.malloy');
    urlReader.setFile(
      aURL,
      `
        import 'file://b.malloy'

        source: a is duckdb.sql("SELECT 1 as one")
      `
    );
    urlReader.setFile(
      bURL,
      `
        source: b is duckdb.sql("SELECT 1 as one")
      `
    );
    const model1 = await runtime.getModel(aURL);
    expect(model1.problems).toMatchObject([]);
    const aCached = await modelCache.getModel(aURL);
    expect(aCached).toBeDefined();
    if (aCached === undefined) return;
    expect(aCached.modelDef.contents['a']).toBeDefined();
    expect(aCached.modelDef.dependencies).toMatchObject({
      'file://b.malloy/': {},
    });
    expect(aCached.modelDef.contents['a']).toBeDefined();
    urlReader.setFile(
      bURL,
      `
        source: c is duckdb.sql("SELECT 1 as one")
      `
    );
    const model2 = await runtime.getModel(aURL);
    expect(model2._modelDef.contents['c']).toBeDefined();
    expect(model2._modelDef.contents['a']).toBeDefined();
    expect(model2._modelDef.contents['a2']).not.toBeDefined();
    // We want to check that it's going to use the cached version of b...
    // so we'll sneakily modify the cache in an evil way:
    const existingModel = await modelCache.getModel(bURL);
    expect(existingModel).toBeDefined();
    if (existingModel === undefined) return;
    await modelCache.setModel(
      bURL,
      {
        ...existingModel.modelDef,
        contents: {
          ...existingModel.modelDef.contents,
          'sneaky': existingModel.modelDef.contents['c'],
        },
        exports: ['sneaky'],
      },
      existingModel.invalidationKeys
    );
    urlReader.setFile(
      aURL,
      `
        import 'file://b.malloy'

        source: sneaky_copy is sneaky extend {}
      `
    );
    const model3 = await runtime.getModel(aURL);
    expect(model3._modelDef.contents['sneaky_copy']).toBeDefined();
    expect(model3._modelDef.contents['a']).not.toBeDefined();
  });
});
