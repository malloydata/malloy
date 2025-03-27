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

import {annotationToTag} from '@malloydata/malloy';
import type {TagDict} from '@malloydata/malloy-tag';
import {Tag} from '@malloydata/malloy-tag';
import {runtimeFor} from '../runtimes';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      tagsAre(t: TagDict): R;
    }
  }
}

expect.extend({
  tagsAre(src: string | Tag, result: Tag) {
    if (typeof src === 'string') {
      const {tag, log} = Tag.fromTagLine(src, undefined);
      const errs = log.map(e => e.message);
      if (log.length > 0) {
        return {
          pass: false,
          message: () => `${src}: Tag Parsing Error(s)\n${errs.join('\n')}`,
        };
      }
      src = tag;
    }
    const got = src.properties;
    if (this.equals(got, result)) {
      return {
        pass: true,
        message: () => 'Parse returned expected object',
      };
    }
    const expected = this.utils.printExpected(result);
    const received = this.utils.printReceived(got);
    return {
      pass: false,
      message: () => `Expected: ${expected}\nReceived: ${received}`,
    };
  },
});

const runtime = runtimeFor('duckdb');

describe('## top level', () => {
  test('top level tags are available in the model def', async () => {
    const model = await runtime
      .loadModel(
        `
        ## propertyTag
        ##" Doc String
      `
      )
      .getModel();
    const modelTagLine = model.tagParse().tag;
    expect(modelTagLine.has('propertyTag')).toBeTruthy();
    expect(model.getTaglines(/^##"/)).toEqual(['##" Doc String\n']);
  });
});
describe('tags in results', () => {
  test('nameless query', async () => {
    const loaded = runtime.loadQuery(
      `
        ## modelDef=ok
        source: one is duckdb.sql("SELECT 1 as one")
        # b4query
        run: # afterQuery import=$(modelDef)
          one -> { select: * }`
    );
    const qTag = {b4query: {}, afterQuery: {}, import: {eq: 'ok'}};
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.tagParse().tag).tagsAre(qTag);
    const result = await loaded.run();
    expect(result.tagParse().tag).tagsAre(qTag);
  });
  const wantTag = {BQ: {}, AQ: {}, Bis: {}, Ais: {}, import: {eq: 'ok'}};
  test('named query', async () => {
    const loaded = runtime.loadQuery(
      `
        ## modelDef=ok
        source: one is duckdb.sql("SELECT 1 as one")
        # BQ
        query: # AQ
          # import=$(modelDef)
          theName
          # Bis
          is
          # Ais
          one -> { select: * }
        run: theName
      `
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.tagParse().tag).tagsAre(wantTag);
    const result = await loaded.run();
    expect(result.tagParse().tag).tagsAre(wantTag);
  });
  test('turtle query', async () => {
    const loaded = runtime.loadQuery(
      `
        ## modelDef=ok
        source: one is duckdb.sql("SELECT 1 as one") extend {
          # BQ import=$(modelDef)
          view: # AQ
            in_one
            # Bis
            is
            # Ais
            { select: one }
        }
        run: one -> in_one
      `
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.tagParse().tag).tagsAre(wantTag);
    const result = await loaded.run();
    expect(result.tagParse().tag).tagsAre(wantTag);
  });
  test('field ref has tag', async () => {
    const loaded = runtime.loadQuery(
      `run: duckdb.sql("select 1 as num") extend {
        dimension: # sourceNote
          one is num
        } -> {
          select: # queryNote
          one
      }`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const one = shape.getFieldByName('one');
    expect(one).toBeDefined();
    const tp = one.tagParse();
    expect(tp.log).toEqual([]);
    expect(tp.tag).tagsAre({sourceNote: {}, queryNote: {}});
  });
  test('atomic field model scope tag', async () => {
    const loaded = runtime.loadQuery(
      `
          ## modelDef=ok
          source: one is duckdb.sql("SELECT 1 as one")
          run: one -> {
            select:
              # note1 import=$(modelDef)
              one
          }`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const one = shape.getFieldByName('one');
    expect(one).toBeDefined();
    const tp = one.tagParse();
    expect(tp.log).toEqual([]);
    expect(tp.tag).tagsAre({note1: {}, import: {eq: 'ok'}});
  });
  test('nested query has tag', async () => {
    const loaded = runtime.loadQuery(
      `
          ## modelDef=ok
          source: one is duckdb.sql("SELECT 1 as one")
          source: malloy_one is one extend {
            view: in_one is {
              select: one
            }
            view: one_and_one is {
              group_by: one
              # note1
              nest:
                # note2 import=$(modelDef)
                in_one
            }
          }
          run: malloy_one -> one_and_one`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const one = shape.getFieldByName('in_one');
    expect(one).toBeDefined();
    expect(one.tagParse().tag).tagsAre({
      note1: {},
      note2: {},
      import: {eq: 'ok'},
    });
  });
  test('render usage test case', async () => {
    const loaded = runtime.loadQuery(
      `
        source: ages is duckdb.sql('SELECT 1 as one') extend {
          # name
          dimension: name is 'John'
          view: height
          # barchart
          is {
            select: heightd is 10
          }

          view: age
          # barchart
          is {
            select: aged is 20
          }

        }
        run: ages -> {
          group_by: name
          nest: height
          nest: age
        }
        `
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const height = shape.getFieldByName('height');
    const age = shape.getFieldByName('age');
    const name = shape.getFieldByName('name');
    expect(height.tagParse().tag).tagsAre({barchart: {}});
    expect(age.tagParse().tag).tagsAre({barchart: {}});
    expect(name.tagParse().tag).tagsAre({name: {}});
  });
  test('User defined scopes nest properly', async () => {
    const loaded = runtime.loadQuery(
      `
          ## scope=model
          run: duckdb.sql("SELECT 1 as one") -> {
            select:
              # valueFrom=$(scope)
              one
          }`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const field = shape.getFieldByName('one');
    expect(field).toBeDefined();
    let tp = field.tagParse().tag;
    expect(tp).tagsAre({valueFrom: {eq: 'model'}});
    const sessionScope = Tag.fromTagLine('# scope=session', undefined).tag;
    tp = field.tagParse({scopes: [sessionScope]}).tag;
    expect(tp).tagsAre({valueFrom: {eq: 'session'}});
    const globalScope = Tag.fromTagLine('# scope=global', undefined).tag;
    tp = field.tagParse({scopes: [globalScope, sessionScope]}).tag;
    expect(tp).tagsAre({valueFrom: {eq: 'global'}});
  });
  test('inherited model tags override', async () => {
    const model = runtime.loadModel(
      '## from=cell1\nsource: one is duckdb.sql("select 1")'
    );
    const model2 = model.extendModel('## from=cell2');
    const query = model2.loadQuery('run: one -> {select: `1`}');
    const result = await query.run();
    const modelTags = result.modelTag;
    expect(modelTags.text('from')).toEqual('cell2');
  });
  test('nested fields of same field do not share tags', async () => {
    const loaded = runtime.loadQuery(`
      source: one is duckdb.sql("SELECT 1 as one")
      run: one -> {
        nest: a is {
          # a
          group_by: one
        }
        nest: b is {
          # b
          group_by: one
        }
      }
    `);
    const result = await loaded.run();
    const shape = result.resultExplore;
    const a = shape.getFieldByName('a');
    expect(a.isExploreField()).toBe(true);
    if (a.isExploreField()) {
      const one = a.getFieldByName('one');
      expect(one.tagParse().tag).tagsAre({
        a: {},
      });
    }
  });
  test('inherits can be over-ridden', () => {
    const loc1 = {
      url: 'inherit-test',
      range: {start: {line: 1, character: 0}, end: {line: 1, character: 0}},
    };
    const loc2 = {
      url: 'inherit-test',
      range: {start: {line: 2, character: 0}, end: {line: 2, character: 0}},
    };
    const nestedTags = annotationToTag({
      inherits: {notes: [{text: '## from=inherits\n', at: loc1}]},
      notes: [{text: '## from=notes\n', at: loc2}],
    });
    const fromVal = nestedTags.tag.text('from');
    expect(fromVal).toEqual('notes');
  });
});
