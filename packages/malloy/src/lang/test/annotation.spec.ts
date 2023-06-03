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

import {TestTranslator} from './test-translator';
import './parse-expects';

describe('annotation collection', () => {
  test('single source annotation', () => {
    const m = new TestTranslator(`
      # note1
      source: note_a is a
    `);
    expect(m).modelCompiled();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({notes: ['# note1\n']});
    }
  });
  test('multi line source annotation', () => {
    const m = new TestTranslator(`
      # note1
      # note2
      source: note_a is a
    `);
    expect(m).modelCompiled();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        notes: ['# note1\n', '# note2\n'],
      });
    }
  });
  test('inherited annotation source', () => {
    const m = new TestTranslator(`
      # note0
      source: note_b is a
      # note1
      source: note_a is note_b { primary_key: ai }
    `);
    expect(m).modelCompiled();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        inherit: {notes: ['# note0\n']},
        notes: ['# note1\n'],
      });
    }
  });
  test('single query annotation', () => {
    const m = new TestTranslator(`
      # note1
      query: note_a is a -> {project: *}
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({notes: ['# note1\n']});
    }
  });
  test('multi line query annotation', () => {
    const m = new TestTranslator(`
      # note1
      # note2
      query: note_a is a -> {project: *}
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        notes: ['# note1\n', '# note2\n'],
      });
    }
  });
  test('inherited annotation query', () => {
    const m = new TestTranslator(`
      # note0
      query: note_b is a -> { project: * }
      # note1
      query: note_a is -> note_b { where: astr = 'a' }
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        inherit: {notes: ['# note0\n']},
        notes: ['# note1\n'],
      });
    }
  });

  test('single turtle annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # note1
        query: qa is {project: *}
      }
      query: note_a is na->qa
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({notes: ['# note1\n']});
    }
  });
  test.todo('use api to run the tests below');
  //   test('doc annotations', () => {
  //     const a = new ObjectAnnotation.make('#" This is a doc string');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({docString: 'This is a doc string'});
  //     }
  //   });
  //   test('simple property', () => {
  //     const a = ObjectAnnotation.make('# linechart');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {linechart: true}});
  //     }
  //   });
  //   test('simple quoted property', () => {
  //     const a = ObjectAnnotation.make('# "linechart"');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {linechart: true}});
  //     }
  //   });
  //   test('quoted property with " and space', () => {
  //     const annotation = '# "a \\"chart\\""';
  //     const a = ObjectAnnotation.make(annotation);
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {'a \\"chart\\"': true}});
  //     }
  //   });
  //   test('quoted property with value', () => {
  //     const a = ObjectAnnotation.make('# "linechart"=yes');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {linechart: 'yes'}});
  //     }
  //   });
  //   test('property with simple value', () => {
  //     const a = ObjectAnnotation.make('# chart=line');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {chart: 'line'}});
  //     }
  //   });
  //   test('property with quoted value', () => {
  //     const a = ObjectAnnotation.make('# chart="line"');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {chart: 'line'}});
  //     }
  //   });
  //   test('spaces ignored', () => {
  //     const a = ObjectAnnotation.make('#     chart =  line ');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({properties: {chart: 'line'}});
  //     }
  //   });
  //   test('= with no value', () => {
  //     expect(ObjectAnnotation.make('# name =  ')).toBeUndefined();
  //   });
  //   test('multiple = with no value', () => {
  //     expect(ObjectAnnotation.make('# name =  = me')).toBeUndefined();
  //   });
  //   test('missing quote', () => {
  //     expect(ObjectAnnotation.make('# name =  "no quote')).toBeUndefined();
  //   });
  //   test('leading =', () => {
  //     expect(ObjectAnnotation.make('#  =name  ')).toBeUndefined();
  //   });
  //   test('complex line', () => {
  //     const a = ObjectAnnotation.make('# a b=c "d"=e f="g" "h"="i" "j"');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toMatchObject({
  //         properties: {
  //           a: true,
  //           b: 'c',
  //           d: 'e',
  //           f: 'g',
  //           h: 'i',
  //           j: true,
  //         },
  //       });
  //     }
  //   });
});
