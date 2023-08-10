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

import {Tags, Annotation, MalloyTags, TagDict, Tag} from '@malloydata/malloy';
import {runtimeFor} from './runtimes';

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
      const {tag, log} = Tag.fromTagline(src, undefined);
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

interface TestAnnotation {
  inherits?: TestAnnotation;
  blockNotes?: string[];
  notes: string[];
}

function unTestify(ta: TestAnnotation): Annotation {
  const dloc = {
    url: __filename,
    range: {start: {character: 0, line: 0}, end: {character: 0, line: 0}},
  };
  const ret: Annotation = {
    notes: ta.notes.map(t => {
      return {text: t, at: dloc};
    }),
  };
  if (ta.blockNotes) {
    ret.blockNotes = ta.blockNotes.map(t => {
      return {text: t, at: dloc};
    });
  }
  if (ta.inherits) {
    ret.inherits = unTestify(ta.inherits);
  }
  return ret;
}

class TestTags extends Tags {
  constructor(ta: TestAnnotation) {
    super(unTestify(ta));
  }
}

function tstTaglist(a: TestAnnotation): string[] {
  return new TestTags(a).getTagList();
}

function tstTagParse(s: string): MalloyTags {
  return new TestTags({notes: [s]}).getMalloyTags();
}

describe('tag utilities', () => {
  test('own/block ordering is correct', () => {
    const testA = tstTaglist({
      notes: ['#tag'],
      blockNotes: ['#blockTag'],
    });
    expect(testA).toEqual(['#blockTag', '#tag']);
  });
  test('inherit ordering is correct', () => {
    const testA = tstTaglist({
      inherits: {notes: ['#inherited']},
      notes: ['#tag'],
    });
    expect(testA).toEqual(['#inherited', '#tag']);
  });
  test.todo('check that results are annotated');
  test('doc annotations', () => {
    const a = tstTagParse('#" This is a doc string');
    expect(a).toMatchObject({docStrings: ['This is a doc string']});
  });
  test('simple property', () => {
    const a = tstTagParse('# linechart');
    expect(a.properties).toHaveProperty('linechart', true);
  });
  test('negated property', () => {
    const a = tstTagParse('# linechart -linechart');
    expect(a.properties).not.toHaveProperty('linechart', true);
  });
  test('simple quoted property', () => {
    const a = tstTagParse('# "linechart"');
    expect(a.properties).toHaveProperty('linechart', true);
  });
  test('quoted property with " and space', () => {
    const annotation = '# "a \\"chart\\""';
    const a = tstTagParse(annotation);
    expect(a.properties).toHaveProperty('a "chart"', true);
  });
  test('escaped non-quote', () => {
    const annotation = '# "\\x"';
    const a = tstTagParse(annotation);
    expect(a.properties).toHaveProperty('x', true);
  });
  test('non-terminated string', () => {
    const annotation = '# x="\\"';
    const a = tstTagParse(annotation);
    expect(a.properties).not.toHaveProperty('x', true);
  });
  test('quoted property with value', () => {
    const a = tstTagParse('# "linechart"=yes');
    expect(a.properties).toHaveProperty('linechart', 'yes');
  });
  test('property with simple value', () => {
    const a = tstTagParse('# chart=line');
    expect(a.properties).toHaveProperty('chart', 'line');
  });
  test('property with quoted value', () => {
    const a = tstTagParse('# chart="line"');
    expect(a.properties).toHaveProperty('chart', 'line');
  });
  test('spaces ignored', () => {
    const a = tstTagParse('#     chart =  line ');
    expect(a.properties).toHaveProperty('chart', 'line');
  });
  test('= with no value', () => {
    expect(tstTagParse('# name =  ')).toMatchObject({properties: {}});
  });
  test('multiple = with no value', () => {
    expect(tstTagParse('# name =  = me')).toMatchObject({properties: {}});
  });
  test('missing quote', () => {
    expect(tstTagParse('# name =  "no quote')).toMatchObject({properties: {}});
  });
  test('leading =', () => {
    expect(tstTagParse('#  =name  ')).toMatchObject({properties: {}});
  });
  test('complex line', () => {
    const a = tstTagParse('# a b=c "d"=e f="g" "h"="i" "j" k -a');
    expect(a).toBeDefined();
    if (a) {
      expect(a.properties).toEqual({
        b: 'c',
        d: 'e',
        f: 'g',
        h: 'i',
        j: true,
        k: true,
      });
    }
  });
});

type TagTestTuple = [string, TagDict];
describe('expanded tag language', () => {
  const tagTests: TagTestTuple[] = [
    ['just_name', {just_name: {}}],
    ['name=bare_string', {name: {eq: 'bare_string'}}],
    ['name="quoted_string"', {name: {eq: 'quoted_string'}}],
    ['name {prop1}', {name: {properties: {prop1: {}}}}],
    [
      'name {prop1 prop2=value}',
      {
        name: {
          properties: {
            prop1: {},
            prop2: {eq: 'value'},
          },
        },
      },
    ],
    ['name.prop', {name: {properties: {prop: {}}}}],
    ['name.prop=value', {name: {properties: {prop: {eq: 'value'}}}}],
    [
      'name.prop.sub=value',
      {name: {properties: {prop: {properties: {sub: {eq: 'value'}}}}}},
    ],
    [
      'name{first3=[a, b, c]}',
      {name: {properties: {first3: {eq: [{eq: 'a'}, {eq: 'b'}, {eq: 'c'}]}}}},
    ],
    ['name{first1=[a,]}', {name: {properties: {first1: {eq: [{eq: 'a'}]}}}}],
    [
      'name{first=[a {A}]}',
      {name: {properties: {first: {eq: [{eq: 'a', properties: {A: {}}}]}}}},
    ],
    [
      'name{first=[{A}]}',
      {name: {properties: {first: {eq: [{properties: {A: {}}}]}}}},
    ],
    ['name=value {prop}', {name: {eq: 'value', properties: {prop: {}}}}],
    [
      'name.prop={prop2}',
      {name: {properties: {prop: {properties: {prop2: {}}}}}},
    ],
    ['no yes -no', {yes: {}}],
    ['x={y z} -x.y', {x: {properties: {z: {}}}}],
    ['x={y z} x {-y}', {x: {properties: {z: {}}}}],
    ['x=1 x {xx=11}', {x: {eq: '1', properties: {xx: {eq: '11'}}}}],
    ['x.y=xx x=1 {...}', {x: {eq: '1', properties: {y: {eq: 'xx'}}}}],
    ['a {b c} a=1', {a: {eq: '1'}}],
    ['a=1 a=...{b}', {a: {eq: '1', properties: {b: {}}}}],
    [
      'a=red { shade=dark } color=$(a) shade=$(a.shade)',
      {
        a: {eq: 'red', properties: {shade: {eq: 'dark'}}},
        color: {eq: 'red', properties: {shade: {eq: 'dark'}}},
        shade: {eq: 'dark'},
      },
    ],
  ];
  test.each(tagTests)('tag %s', (expression: string, expected: TagDict) => {
    expect(expression).tagsAre(expected);
  });
  test('uncomment to debug just one of the expressions', () => {
    const x: TagTestTuple = ['a=a b=$(a)', {a: {eq: 'a'}, b: {eq: 'a'}}];
    expect(x[0]).tagsAre(x[1]);
  });
});

describe('test tag api', () => {
  test('just text', () => {
    const strToParse = 'a=b';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.text()).toEqual('b');
  });
  test('tag path', () => {
    const strToParse = 'a.b.c.d.e=f';
    const tagParse = Tag.fromTagline(strToParse, undefined);
    expect(tagParse.log).toEqual([]);
    const abcde = tagParse.tag.tag('a', 'b', 'c', 'd', 'e');
    expect(abcde).toBeDefined();
    expect(abcde?.text()).toEqual('f');
  });
  test('just array', () => {
    const strToParse = 'a=[b]';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    const aval = a?.array();
    expect(aval).toBeDefined();
    if (aval) {
      expect(aval.length).toEqual(1);
      expect(aval[0].text()).toEqual('b');
    }
  });
  test('array as text', () => {
    const strToParse = 'a=[b]';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.text()).toEqual('');
  });
  test('text as array', () => {
    const strToParse = 'a=b';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    expect(a?.array()).toEqual([]);
  });
  test('just numeric', () => {
    const strToParse = 'a=7';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(typeof n).toBe('number');
    expect(n).toEqual(7);
  });
  test('text as numeric', () => {
    const strToParse = 'a=seven';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(typeof n).toBe('number');
    expect(n).toBeNaN();
  });
  test('array as numeric', () => {
    const strToParse = 'a=[seven]';
    const getTags = Tag.fromTagline(strToParse, undefined);
    expect(getTags.log).toEqual([]);
    const a = getTags.tag.tag('a');
    expect(a).toBeDefined();
    const n = a?.numeric();
    expect(typeof n).toBe('number');
    expect(n).toBeNaN();
  });
});

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
    const modelDesc = model.getTags().getMalloyTags();
    expect(modelDesc).toEqual({
      properties: {propertyTag: true},
      docStrings: ['Doc String\n'],
    });
    const modelTagLine = model.tagParse().tag;
    expect(modelTagLine.has('propertyTag')).toBeTruthy();
  });
});
describe('tags in results', () => {
  test('nameless query', async () => {
    const loaded = runtime.loadQuery(
      `
          sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
          # b4query
          query: # afterQuery
            from_sql(one) -> { project: * }`
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    const wantTags = ['# b4query\n', '# afterQuery\n'];
    expect(query.getTags().getTagList()).toEqual(wantTags);
    const result = await loaded.run();
    expect(result.getTags().getTagList()).toEqual(wantTags);
    const queryTags = result.tagParse().tag;
    expect(queryTags).tagsAre({b4query: {}, afterQuery: {}});
  });
  const wantTags = ['# BQ\n', '# AQ\n', '# Bis\n', '# Ais\n'];
  const wantTag = {BQ: {}, AQ: {}, Bis: {}, Ais: {}};
  test('named query', async () => {
    const loaded = runtime.loadQuery(
      `
          sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
          # BQ
          query: # AQ
            theName
            # Bis
            is
            # Ais
            from_sql(one) -> { project: * }
          query: -> theName`
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.getTags().getTagList()).toEqual(wantTags);
    const result = await loaded.run();
    expect(result.getTags().getTagList()).toEqual(wantTags);
    expect(result.tagParse().tag).tagsAre(wantTag);
  });
  test('turtle query', async () => {
    const loaded = runtime.loadQuery(
      `
          sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
          query: from_sql(one) + {
            # BQ
            query: # AQ
              in_one
              # Bis
              is
              # Ais
              { project: one }
            }
          -> in_one`
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.getTags().getTagList()).toEqual(wantTags);
    expect(query.tagParse().tag).tagsAre(wantTag);
    const result = await loaded.run();
    const tl = result.getTags().getTagList();
    expect(tl).toEqual(wantTags);
    expect(result.tagParse().tag).tagsAre(wantTag);
  });
  test('atomic field has tag', async () => {
    const loaded = runtime.loadQuery(
      `
          sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
          query: from_sql(one) -> {
            project:
              # note1
              one
          }`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const one = shape.getFieldByName('one');
    expect(one).toBeDefined();
    expect(one.getTags().getTagList()).toEqual(['# note1\n']);
    expect(one.tagParse().tag).tagsAre({note1: {}});
  });
  test('nested query has tag', async () => {
    const loaded = runtime.loadQuery(
      `
          sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
          source: malloy_one is from_sql(one) + {
            query: in_one is {
              project: one
            }
            query: one_and_one is {
              group_by: one
              # note1
              nest:
                # note2
                in_one
            }
          }
          query: malloy_one -> one_and_one`
    );
    const result = await loaded.run();
    const shape = result.resultExplore;
    const one = shape.getFieldByName('in_one');
    expect(one).toBeDefined();
    expect(one.getTags().getTagList()).toEqual(['# note1\n', '# note2\n']);
    expect(one.tagParse().tag).tagsAre({note1: {}, note2: {}});
  });
  test('render usage test case', async () => {
    const loaded = runtime.loadQuery(
      `
        sql: one22 is { connection: "duckdb" select: """SELECT 1""" }
        source: ages is from_sql(one22) + {
          dimension: name is 'John'
          query: height
          # barchart
          is {
            project: heightd is 10
          }

          query: age
          # barchart
          is {
            project: aged is 20
          }

        }
        query: ages -> {
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
    expect(height.getTags().getMalloyTags()).toMatchObject({
      properties: {barchart: true},
    });
    expect(height.tagParse().tag).tagsAre({barchart: {}});
    expect(age.getTags().getMalloyTags()).toMatchObject({
      properties: {barchart: true},
    });
    expect(age.tagParse().tag).tagsAre({barchart: {}});
  });
});
