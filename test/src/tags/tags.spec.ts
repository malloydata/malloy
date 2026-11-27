/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {testDatabase} from '../test_database';
import {annotationToTag} from '@malloydata/malloy';
import type {TagDict, Tag} from '@malloydata/malloy-tag';
import {parseTag, interfaceFromDict} from '@malloydata/malloy-tag';

afterAll(() => testDatabase.shutdown());

describe('tags', () => {
  test('view run as query gets tags in explore', async () => {
    const model = testDatabase.runtime.loadModel(`
      source: aircraft is db.table('malloytest.aircraft') extend {
        # bar_chart
        view: by_state is {
          group_by: state
          aggregate: aircraft_count is count()
        }
      }
    `);
    const query = model.loadQuery('run: aircraft -> by_state');
    const result = await query.run();
    expect(result.resultExplore.tagParse().tag.has('bar_chart')).toBe(true);
  });
});

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
      const {tag, log} = parseTag(src);
      const errs = log.map(e => e.message);
      if (log.length > 0) {
        return {
          pass: false,
          message: () => `${src}: Tag Parsing Error(s)\n${errs.join('\n')}`,
        };
      }
      src = tag;
    }
    const got = src.properties ? interfaceFromDict(src.properties) : undefined;
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

describe('## top level', () => {
  test('top level tags are available in the model def', async () => {
    const model = await testDatabase.runtime
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
  const wantTag = {BQ: {}, AQ: {}, Bis: {}, Ais: {}};
  test('nameless query', async () => {
    const loaded = testDatabase.runtime.loadQuery(
      `
        ## modelDef=ok
        source: one is db.sql("SELECT 1 as one")
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
  test('named query', async () => {
    const loaded = testDatabase.runtime.loadQuery(
      `
        source: one is db.sql("SELECT 1 as one")
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
    const loaded = testDatabase.runtime.loadQuery(
      `
        source: one is db.sql("SELECT 1 as one") extend {
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
    const loaded = testDatabase.runtime.loadQuery(
      `run: db.sql("select 1 as num") extend {
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
    const loaded = testDatabase.runtime.loadQuery(`
      run: db.sql("select 1 as num") -> {
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
    const loaded = testDatabase.runtime.loadQuery(
      `
          source: one is db.sql("SELECT 1 as one")
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
    const loaded = testDatabase.runtime.loadQuery(
      `
          source: one is db.sql("SELECT 1 as one")
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
    const loaded = testDatabase.runtime.loadQuery(
      `
        source: ages is db.sql('SELECT 1 as one') extend {
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
    const model = testDatabase.runtime.loadModel(
      '## from=cell1\nsource: one is db.sql("select 1")'
    );
    const model2 = model.extendModel('## from=cell2');
    const query = model2.loadQuery('run: one -> {select: `1`}');
    const result = await query.run();
    const modelTags = result.modelTag;
    expect(modelTags.text('from')).toEqual('cell2');
  });
  test('nested fields of same field do not share tags', async () => {
    const loaded = testDatabase.runtime.loadQuery(`
      source: one is db.sql("SELECT 1 as one")
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
    const run1 = testDatabase.runtime.loadQuery(`
      source: one is db.sql("SELECT 1 as one") extend {
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

describe('property names inherited from Object.prototype', () => {
  // A tag property name comes from source text, so `__proto__`, `constructor`
  // and `toString` are ordinary names with no special meaning.
  test('an annotation carries an inherited name through to the result', async () => {
    const loaded = testDatabase.runtime.loadQuery(
      `run: db.sql("select 1 as num") -> {
        select:
          # __proto__=1 toString.nested=2 constructor
          one is num
      }`
    );
    const result = await loaded.run();
    const one = result.resultExplore.getFieldByName('one');
    const {tag, log} = one.tagParse();
    expect(log).toEqual([]);
    expect(tag.numeric('__proto__')).toEqual(1);
    expect(tag.numeric('toString', 'nested')).toEqual(2);
    expect(tag.has('constructor')).toBe(true);
    expect(tag.has('valueOf')).toBe(false);
  });
});
