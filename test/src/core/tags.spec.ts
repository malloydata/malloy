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
        run: # afterQuery
          one -> { select: * }`
    );
    const qTag = {b4query: {}, afterQuery: {}};
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.tagParse().tag).tagsAre(qTag);
    const result = await loaded.run();
    expect(result.tagParse().tag).tagsAre(qTag);
  });
  const wantTag = {BQ: {}, AQ: {}, Bis: {}, Ais: {}};
  test('named query', async () => {
    const loaded = runtime.loadQuery(
      `
        source: one is duckdb.sql("SELECT 1 as one")
        # BQ
        query: # AQ
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
        source: one is duckdb.sql("SELECT 1 as one") extend {
          # BQ
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
  test('field ref has tag through pipeline', async () => {
    const loaded = runtime.loadQuery(`
      run: duckdb.sql("select 1 as num") -> {
        select:
          # stage1Note
          num
      } -> {
        select:
          # stage2Note
          num
      }
    `);
    const result = await loaded.run();
    const shape = result.resultExplore;
    const num = shape.getFieldByName('num');
    expect(num).toBeDefined();
    const tp = num.tagParse();
    expect(tp.log).toEqual([]);
    // Stage 2 should have both its own annotation and the inherited one from stage 1
    expect(tp.tag).tagsAre({stage1Note: {}, stage2Note: {}});
  });
  test('atomic field tag', async () => {
    const loaded = runtime.loadQuery(
      `
          source: one is duckdb.sql("SELECT 1 as one")
          run: one -> {
            select:
              # note1
              one
          }`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const one = shape.getFieldByName('one');
    expect(one).toBeDefined();
    const tp = one.tagParse();
    expect(tp.log).toEqual([]);
    expect(tp.tag).tagsAre({note1: {}});
  });
  test('nested query has tag', async () => {
    const loaded = runtime.loadQuery(
      `
          source: one is duckdb.sql("SELECT 1 as one")
          source: malloy_one is one extend {
            view: in_one is {
              select: one
            }
            view: one_and_one is {
              group_by: one
              # note1
              nest:
                # note2
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
  test('run: from turtle inherits can disable turtle tags', async () => {
    const run1 = runtime.loadQuery(`
      source: one is duckdb.sql("SELECT 1 as one") extend {
        # blockNote b1
        view:
        # note n2
        view1 is { select: * }
      }
      # -blockNote b3
      run:
        # -note n4
        one -> view1
    `);
    const result = await run1.run();
    const lineSrc = result.resultExplore.getTaglines().map(s => s.trim());
    expect(lineSrc).toEqual([
      '# blockNote b1',
      '# note n2',
      '# -blockNote b3',
      '# -note n4',
    ]);
    const tags = result.resultExplore.tagParse().tag;
    expect(tags.has('blockNote')).toBeFalsy();
    expect(tags.has('note')).toBeFalsy();
    expect(tags.has('b1')).toBeTruthy();
    expect(tags.has('b3')).toBeTruthy();
    expect(tags.has('n2')).toBeTruthy();
    expect(tags.has('n4')).toBeTruthy();
  });
});

afterAll(async () => {
  await runtime.connection.close();
});
