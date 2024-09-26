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

import {
  TestTranslator,
  errorMessage,
  getFieldDef,
  getQueryFieldDef,
  model,
} from './test-translator';
import './parse-expects';
import {diff} from 'jest-diff';
import {Annotation} from '../../model/malloy_types';

interface TstAnnotation {
  inherits?: TstAnnotation;
  blockNotes?: string[];
  notes?: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      matchesAnnotation(tt: TstAnnotation): R;
    }
  }
}

expect.extend({
  matchesAnnotation(result: Annotation, shouldBe: TstAnnotation) {
    function stripAt(a: Annotation): TstAnnotation {
      const clean: TstAnnotation = {};
      if (a.inherits) {
        clean.inherits = stripAt(a.inherits);
      }
      if (a.blockNotes) {
        clean.blockNotes = a.blockNotes.map(bn => bn.text);
      }
      if (a.notes) {
        clean.notes = a.notes.map(n => n.text);
      }
      return clean;
    }
    const got = stripAt(result);
    if (!this.equals(got, shouldBe)) {
      return {
        pass: false,
        message: () => diff(shouldBe, got, {expand: true}) || '',
      };
    }
    return {
      pass: true,
      message: () => '',
    };
  },
});

const defaultTags = {
  blockNotes: ['# blockNote\n'],
  notes: ['# note\n', '# b4-is\n', '# after-is\n'],
};

const turtleDef = `
source: na is a extend {
  # blockNote
  view:
  # note
    note_a
    # b4-is
    is
    # after-is
    {select: *}
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
    expect(m).toTranslate();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation(defaultTags);
    }
    const note_b = m.getSourceDef('note_b');
    expect(note_b).toBeDefined();
    if (note_b) {
      expect(note_b.annotation).matchesAnnotation({
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
    expect(m).toTranslate();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation({
        blockNotes: ['# note1\n', '# note1.1\n'],
      });
    }
  });
  test('inherited annotation source', () => {
    const m = new TestTranslator(`
      # note0
      source: note_b is a
      # note1
      source: note_a is note_b extend { primary_key: ai }
    `);
    expect(m).toTranslate();
    const note_a = m.getSourceDef('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation({
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
      a -> {select: *}
    `);
    expect(m).toTranslate();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('run statement annotation points', () => {
    const m = new TestTranslator(`
      # note1
      run:
        # note2
        a -> {select: *}
    `);
    expect(m).toTranslate();
    const note_a = m.getQuery(0);
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation({
        blockNotes: ['# note1\n'],
        notes: ['# note2\n'],
      });
    }
  });
  test('multi line query annotation', () => {
    const m = new TestTranslator(`
      # note1
      # note2
      query: note_a is a -> {select: *}
    `);
    expect(m).toTranslate();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation({
        blockNotes: ['# note1\n', '# note2\n'],
      });
    }
  });
  test('inherited annotation query', () => {
    const m = new TestTranslator(`
    # noteb0
      query:
    # noteb1
        note_b is a -> { select: * }
    # note1
      query: note_a is note_b + { where: astr = 'a' }
    `);
    expect(m).toTranslate();
    const note_a = m.getQuery('note_a');
    expect(note_a).toBeDefined();
    if (note_a) {
      expect(note_a.annotation).matchesAnnotation({
        inherits: {blockNotes: ['# noteb0\n'], notes: ['# noteb1\n']},
        blockNotes: ['# note1\n'],
      });
    }
  });
  test('query from turtle inherits turtle annotation', () => {
    const m = model`
      ${turtleDef}
      # run_block
      run: # run_note
       na -> note_a
    `;
    expect(m).toTranslate();
    const note_a = m.translator.getQuery(0);
    expect(note_a?.annotation).toBeDefined();
    expect(note_a?.annotation).matchesAnnotation({
      blockNotes: ['# run_block\n'],
      notes: ['# run_note\n'],
      inherits: defaultTags,
    });
  });
  test('model annotations', () => {
    const m = new TestTranslator(`
      ## model1
      ## model2
    `);
    expect(m).toTranslate();
    const model = m.translate()?.translated;
    expect(model).toBeDefined();
    const notes = model?.modelDef.annotation;
    expect(notes).matchesAnnotation({notes: ['## model1\n', '## model2\n']});
  });
  test('ignores objectless object annotations', () => {
    const m = new TestTranslator(`
      # note1
      ## model1
    `);
    expect(m).toLog(
      errorMessage('Object annotation not connected to any object')
    );
  });
  test('errors reported from compiler flags', () => {
    expect(`
      ##! missingCloseQuote="...
    `).toLog(errorMessage(/no viable alternative at input/));
  });
  test('checking compiler flags', () => {
    const m = model`
      ##! flagThis
    `;
    expect(m).toTranslate();
    expect(m.translator.compilerFlags.has('flagThis')).toBeTruthy();
  });
  test('extended models inherit model flags', () => {
    const first = model`## from=1\n`;
    expect(first).toTranslate();
    const firstModel = first.translator.translate()?.translated?.modelDef;
    expect(firstModel).toBeDefined();
    const second = model`## from=2\n`;
    second.translator.internalModel = firstModel!;
    const secondModel = second.translator.translate()?.translated?.modelDef;
    expect(secondModel?.annotation).matchesAnnotation({
      inherits: {notes: ['## from=1\n']},
      notes: ['## from=2\n'],
    });
  });
});
describe('source definition annotations', () => {
  test('turtle block annotation', () => {
    const m = new TestTranslator(turtleDef);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a).toBeDefined();
      expect(note_a.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('refined turtle inherits annotation', () => {
    const m = new TestTranslator(`
      ${turtleDef}
      source: new_na is na extend {
        view: new_note_a is note_a
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('new_na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'new_note_a');
      expect(note_a?.annotation).toBeDefined();
      expect(note_a.annotation).matchesAnnotation({inherits: defaultTags});
    }
  });
  test('dimension block annotation', () => {
    const m = new TestTranslator(`
      source: na is a extend {
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
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('measure block annotation', () => {
    const m = new TestTranslator(`
      source: na is a extend {
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
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('join_one-with block annotation', () => {
    const m = new TestTranslator(`
      source: na is a extend {
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
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('join_many-on block annotation', () => {
    const m = new TestTranslator(`
      source: na is a extend {
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
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('ignores model annotation', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        ## model1
      }
    `);
    expect(m).toLog(
      errorMessage('Model annotations not allowed at this scope')
    );
  });
});
describe('query operation annotations', () => {
  test('ignores model annotation', () => {
    expect(`
      run: a -> {
        ## model1
        select: *
      }
    `).toLog(errorMessage('Model annotations not allowed at this scope'));
  });
  test('project new definition annotation', () => {
    const m = new TestTranslator(`
      query: findme is a -> {
        # blockNote
        select:
          # note
          note_a
          # b4-is
          is
          # after-is
          astr
      }
    `);
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('project ref inherits annotation', () => {
    const m = new TestTranslator(`
      run: a extend {
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
        select:
          # note2
          note_a
      }
    `);
    expect(m).toTranslate();
    const foundYou = m.getQuery(0);
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation({
        inherits: defaultTags,
        blockNotes: ['# note1\n'],
        notes: ['# note2\n'],
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
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
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
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('group_by ref inherits', () => {
    const m = new TestTranslator(`
      source: aa is a extend {
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
        # note1
        group_by:
        # note2
        note_a
      }
    `);
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation({
        blockNotes: ['# note1\n'],
        inherits: defaultTags,
        notes: ['# note2\n'],
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
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('aggregate ref inherits', () => {
    const m = new TestTranslator(`
      source: aa is a extend {
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
        # note1
        aggregate:
        # note2
        note_a
      }
    `);
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation({
        blockNotes: ['# note1\n'],
        inherits: defaultTags,
        notes: ['# note2\n'],
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
    expect(m).toTranslate();
    const foundYou = m.getQuery('findme');
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_a = getQueryFieldDef(foundYou.pipeline[0], 'note_a');
      expect(note_a?.annotation).matchesAnnotation(defaultTags);
    }
  });
  test('nest from existing inherits annotation', () => {
    const m = new TestTranslator(`
      ${turtleDef}
      run: na -> {
        nest: note_b is note_a
      }
    `);
    expect(m).toTranslate();
    const foundYou = m.getQuery(0);
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_b = getQueryFieldDef(foundYou.pipeline[0], 'note_b');
      expect(note_b?.annotation).matchesAnnotation({inherits: defaultTags});
    }
  });
  test('annotations preserved from path references', () => {
    const m = model`
      run: a -> {
        extend: {
          join_one: x is
            a extend {
              # blockNote
              dimension:
                # note
                xdim
                # b4-is
                is
                # after-is
                1
            } on x.ai = ai
        }
        group_by: x.xdim
      }`;
    expect(m).toTranslate();
    const foundYou = m.translator.getQuery(0);
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const note_b = getQueryFieldDef(foundYou.pipeline[0], 'xdim');
      expect(note_b?.annotation).matchesAnnotation({inherits: defaultTags});
    }
  });
  test('a reference can have an annotation', () => {
    const m = model`run: a extend {
      # noted
      dimension: noted_str is astr
    } -> {
      select:
        # note
        noted_str
    }`;
    expect(m).toTranslate();
    const foundYou = m.translator.getQuery(0);
    expect(foundYou).toBeDefined();
    if (foundYou) {
      const astr = getQueryFieldDef(foundYou.pipeline[0], 'noted_str');
      expect(astr?.annotation).matchesAnnotation({
        inherits: {blockNotes: ['# noted\n']},
        notes: ['# note\n'],
      });
    }
  });
});
