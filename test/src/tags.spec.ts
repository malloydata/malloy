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

import {Tags, Annotation, MalloyTags} from '@malloydata/malloy';

function tstTaglist(a: Annotation): string[] {
  return new Tags(a).getTagList();
}

function tstTagParse(s: string): MalloyTags {
  return new Tags({notes: [s]}).getMalloyTags();
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
    expect(a.properties).toHaveProperty('a \\"chart\\"', true);
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

import {runtimeFor} from './runtimes';

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
    const modelDesc = model.getTags().getMalloyTags();
    expect(modelDesc).toEqual({
      properties: {propertyTag: true},
      docStrings: ['Doc String\n'],
    });
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
  });
  const wantTags = ['# <Q\n', '# >Q\n', '# >name\n', '# >is\n'];
  test('named query', async () => {
    const loaded = runtime.loadQuery(
      `
        sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
        # <Q
        query: # >Q
          theName
          # >name
          is
          # >is
          from_sql(one) -> { project: * }
        query: -> theName`
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    const wantTags = ['# <Q\n', '# >Q\n', '# >name\n', '# >is\n'];
    expect(query.getTags().getTagList()).toEqual(wantTags);
    const result = await loaded.run();
    expect(result.getTags().getTagList()).toEqual(wantTags);
  });
  test('turtle query', async () => {
    const loaded = runtime.loadQuery(
      `
        sql: one is {connection: "duckdb" select: """SELECT 1 as one"""}
        query: from_sql(one) + {
          # <Q
          query: # >Q
            in_one
            # >name
            is
            # >is
            { project: one }
          }
        -> in_one`
    );
    const query = await loaded.getPreparedQuery();
    expect(query).toBeDefined();
    expect(query.getTags().getTagList()).toEqual(wantTags);
    const result = await loaded.run();
    expect(result.getTags().getTagList()).toEqual(wantTags);
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
    const ht = shape.getFieldByName('height').getTags().getMalloyTags();
    const at = shape.getFieldByName('age').getTags().getMalloyTags();
    expect(ht).toMatchObject({properties: {barchart: true}});
    expect(at).toMatchObject({properties: {barchart: true}});
  });
});
