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

import {TestTranslator, getField} from './test-translator';
import './parse-expects';

const defaultTags = {
  blockNotes: ['# blockNote\n'],
  notes: ['# note\n'],
};

describe('document annotation', () => {
  test('every source annotation point', () => {
    const m = new TestTranslator(`
      # note1
      # note1.1
      source:
      # note2
      note_a
      # note3
      is
      # note4
      a
      # note5
      note_b
      # note6
      is
      # note7
      a
    `);
    expect(m).modelCompiled();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        blockNotes: ['# note1\n', '# note1.1\n'],
        notes: ['# note2\n', '# note3\n', '# note4\n'],
      });
    }
    const note_b = m.getSourceDef('note_b');
    expect(note_b).toBeDefined();
    if (note_b) {
      expect(note_b.annotation).toMatchObject({
        blockNotes: ['# note1\n', '# note1.1\n'],
        notes: ['# note5\n', '# note6\n', '# note7\n'],
      });
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
        blockNotes: ['# note1\n', '# note2\n'],
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
        refines: {blockNotes: ['# note0\n']},
        blockNotes: ['# note1\n'],
      });
    }
  });
  test('define full query annotation points', () => {
    const m = new TestTranslator(`
      # note1
      query:
      # note2
      note_a
      # note3
      is
      # note4
      a -> {project: *}
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        blockNotes: ['# note1\n'],
        notes: ['# note2\n', '# note3\n', '# note4\n'],
      });
    }
  });
  test('anonymous query annotation points', () => {
    const m = new TestTranslator(`
      # note1
      query: a -> {project: *}
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery(0);
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({blockNotes: ['# note1\n']});
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
        blockNotes: ['# note1\n', '# note2\n'],
      });
    }
  });
  test('inherited annotation query', () => {
    const m = new TestTranslator(`
    # noteb0
      query:
    # noteb1
        note_b is a -> { project: * }
    # note1
      query: note_a is -> note_b { where: astr = 'a' }
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject({
        refines: {blockNotes: ['# noteb0\n'], notes: ['# noteb1\n']},
        blockNotes: ['# note1\n'],
      });
    }
  });
});
describe('source definition annotations', () => {
  test('turtle block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        query:
        # note
          note_a is {project: *}
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getField(na, 'note_a');
      expect(note_a).toBeDefined();
      expect(note_a.annotation).toMatchObject(defaultTags);
    }
  });
  test('query inherits turtle annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        query:
          # note
          qa is {project: *}
      }
      query: note_a is na->qa
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toMatchObject(defaultTags);
    }
  });
  test('dimension block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        dimension:
          # note
          note_a is astr
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getField(na, 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test('measure block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        measure:
          # note
          note_a is max(astr)
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getField(na, 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test('join-on block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        join_one:
          # note
          note_a is a on note_a.astr = astr
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getField(na, 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test('join-with block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        join_one:
          # note
          note_a is a with astr
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getField(na, 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
});
describe('query operation annotations', () => {
  test('project annotation', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        project:
          # note
          note_a is astr
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getField(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test('group_by annotation', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        group_by:
          # note
          note_a is astr
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getField(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test('aggregate annotation', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        aggregate:
          # note
          note_a is max(astr)
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getField(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test('nest annotation', () => {
    const m = new TestTranslator(`
      query: findme is ab -> {
        # blockNote
        nest:
          # note
          note_a is aturtle
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getField(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toMatchObject(defaultTags);
    }
  });
  test.todo('use api to run the tests below');
  test.todo('add before-is and after-is tests to defaultTags');
  test.todo('make sure turtles inherit refinements');
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
  // test.skip("property in refines,blockNotes,notes with same name on 1 object");
});
