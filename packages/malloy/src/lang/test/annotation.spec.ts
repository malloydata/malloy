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

import {TestTranslator, getFieldDef} from './test-translator';
import './parse-expects';

const defaultTags = {
  blockNotes: ['# blockNote\n'],
  notes: ['# note\n', '# b4-is\n', '# after-is\n'],
};

const turtleDef = `
source: na is a {
  # blockNote
  query:
  # note
    note_a
    # b4-is
    is
    # after-is
    {project: *}
}
`;

describe('document annotation', () => {
  test('every source annotation point', () => {
    const m = new TestTranslator(`
      # blockNote
      source:
      # note
      note_a
      # b4-is
      is
      # after-is
      a
      # note1
      note_b is a
    `);
    expect(m).modelCompiled();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toEqual(defaultTags);
    }
    const note_b = m.getSourceDef('note_b');
    expect(note_b).toBeDefined();
    if (note_b) {
      expect(note_b.annotation).toEqual({
        blockNotes: defaultTags.blockNotes,
        notes: ['# note1\n'],
      });
    }
  });
  test('multi line source annotation', () => {
    const m = new TestTranslator(`
      # note1
      # note1.1
      source: note_a is a
    `);
    expect(m).modelCompiled();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toEqual({
        blockNotes: ['# note1\n', '# note1.1\n'],
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
      expect(note_a.annotation).toEqual({
        inherits: {blockNotes: ['# note0\n']},
        blockNotes: ['# note1\n'],
      });
    }
  });
  test('define full query annotation points', () => {
    const m = new TestTranslator(`
      # blockNote
      query:
      # note
      note_a
      # b4-is
      is
      # after-is
      a -> {project: *}
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).toEqual(defaultTags);
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
      expect(note_a.annotation).toEqual({blockNotes: ['# note1\n']});
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
      expect(note_a.annotation).toEqual({
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
      expect(note_a.annotation).toEqual({
        inherits: {blockNotes: ['# noteb0\n'], notes: ['# noteb1\n']},
        blockNotes: ['# note1\n'],
      });
    }
  });
  test('query from turtle inherits turtle annotation', () => {
    const m = new TestTranslator(`
      ${turtleDef}
      query: na->note_a
    `);
    expect(m).modelCompiled();
    const note_a = m.getQuery(0);
    expect(note_a?.annotation).toBeDefined();
    expect(note_a?.annotation).toEqual({inherits: defaultTags});
  });
  test('model annotations', () => {
    const m = new TestTranslator(`
      ## model1
      ## model2
    `);
    expect(m).modelCompiled();
    const model = m.translate()?.translated;
    expect(model).toBeDefined();
    const notes = model?.modelDef.annotation;
    expect(notes).toEqual({notes: ['## model1\n', '## model2\n']});
  });
  test('ignores objectless object annotations', () => {
    const m = new TestTranslator(`
      # note1
      ## model1
    `);
    expect(m).modelCompiled();
  });
});
describe('source definition annotations', () => {
  test('turtle block annotation', () => {
    const m = new TestTranslator(turtleDef);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a).toBeDefined();
      expect(note_a.annotation).toEqual(defaultTags);
    }
  });
  test('refined turtle inherits annotation', () => {
    const m = new TestTranslator(`
      ${turtleDef}
      source: new_na is na + {
        query: new_note_a is note_a
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('new_na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'new_note_a');
      expect(note_a?.annotation).toBeDefined();
      expect(note_a.annotation).toEqual({inherits: defaultTags});
    }
  });
  test('dimension block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        dimension:
          # note
          note_a
          # b4-is
          is
          # after-is
          astr
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test('measure block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        measure:
          # note
          note_a
          # b4-is
          is
          # after-is
          max(astr)
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test('join_one-with block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        join_one:
          # note
          note_a
          # b4-is
          is
          # after-is
          ab with astr
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test('join_many-on block annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        # blockNote
        join_many:
        # note
        note_a
        # b4-is
        is
        # after-is
        a on note_a.astr = astr
      }
    `);
    expect(m).modelCompiled();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test('ignores model annotation', () => {
    const m = new TestTranslator(`
      source: na is a {
        ## model1
      }
    `);
    expect(m).modelCompiled();
  });
});
describe('query operation annotations', () => {
  test('ignores model annotation', () => {
    const m = new TestTranslator(`
      query: a -> {
        ## model1
        project: *
      }
    `);
    expect(m).modelCompiled();
  });
  test('project new definition annotation', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        project:
          # note
          note_a
          # b4-is
          is
          # after-is
          astr
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test.skip('project ref inherits annotation', () => {
    const m = new TestTranslator(`
      query: a + {
        # blockNote
        dimension:
          # note
          note_a
          # b4-is
          is
          # after-is
          astr
      } -> {
        # note1
        project:
          # note2
          note_a
        }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery(0);
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual({
        inherits: defaultTags,
        blockNotes: ['# note1'],
        notes: ['# note2'],
      });
    }
  });
  test('group_by def', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        group_by:
          # note
          note_a
          # b4-is
          is
          # after-is
          astr
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test('caculate def', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        group_by: astr, ai
        # blockNote
        calculate:
          # note
          note_a
          # b4-is
          is
          # after-is
          lag(ai)
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test.skip('group_by ref inherits', () => {
    const m = new TestTranslator(`
      source: aa is a + {
        # blockNote
        dimension:
          # note
          note_a
          # b4-is
          is
          # after-is
          astr
      }
      query: findme is aa -> {
        # note 1
        group_by:
        # note 2
        note_a
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual({
        inherits: defaultTags,
        notes: ['# note1\n', '# note2\n'],
      });
    }
  });
  test('aggregate def', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        aggregate:
          # note
          note_a
          # b4-is
          is
          # after-is
          max(astr)
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test.skip('aggregate ref inherits', () => {
    const m = new TestTranslator(`
      source: aa is a + {
        # blockNote
        measure:
          # note
          note_a
          # b4-is
          is
          # after-is
          max(astr)
      }
      query: findme is aa -> {
        # note 1
        aggregate:
        # note 2
        note_a
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual({
        inherits: defaultTags,
        notes: ['# note1\n', '# note2\n'],
      });
    }
  });
  test('nest annotation', () => {
    const m = new TestTranslator(`
      query: findme is ab -> {
        # blockNote
        nest:
          # note
          note_a
          # b4-is
          is
          # after-is
          aturtle
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).toEqual(defaultTags);
    }
  });
  test('nest from existing inherits annotation', () => {
    const m = new TestTranslator(`
      ${turtleDef}
      query: na -> {
        nest: note_b is note_a
      }
    `);
    expect(m).modelCompiled();
    const foundYou = m.getQuery(0);
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_b = getFieldDef(foundYou.pipeline[0], 'note_b');
      expect(note_b?.annotation).toEqual({inherits: defaultTags});
    }
  });
  test.todo('use api to run the tests below');
  test.todo('check that results are annotated');
  //   test('doc annotations', () => {
  //     const a = new ObjectAnnotation.make('#" This is a doc string');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({docString: 'This is a doc string'});
  //     }
  //   });
  //   test('simple property', () => {
  //     const a = ObjectAnnotation.make('# linechart');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {linechart: true}});
  //     }
  //   });
  //   test('simple quoted property', () => {
  //     const a = ObjectAnnotation.make('# "linechart"');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {linechart: true}});
  //     }
  //   });
  //   test('quoted property with " and space', () => {
  //     const annotation = '# "a \\"chart\\""';
  //     const a = ObjectAnnotation.make(annotation);
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {'a \\"chart\\"': true}});
  //     }
  //   });
  //   test('quoted property with value', () => {
  //     const a = ObjectAnnotation.make('# "linechart"=yes');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {linechart: 'yes'}});
  //     }
  //   });
  //   test('property with simple value', () => {
  //     const a = ObjectAnnotation.make('# chart=line');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {chart: 'line'}});
  //     }
  //   });
  //   test('property with quoted value', () => {
  //     const a = ObjectAnnotation.make('# chart="line"');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {chart: 'line'}});
  //     }
  //   });
  //   test('spaces ignored', () => {
  //     const a = ObjectAnnotation.make('#     chart =  line ');
  //     expect(a).toBeDefined();
  //     if (a) {
  //       expect(a.annote).toEqual({properties: {chart: 'line'}});
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
  //       expect(a.annote).toEqual({
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
