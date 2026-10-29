/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  TestTranslator,
  errorMessage,
  getFieldDef,
  getQueryFieldDef,
  model,
  warning,
  warningMessage,
} from './test-translator';
import './parse-expects';
import {diff} from 'jest-diff';
import type {AnnotationsDef, Note} from '../../model/malloy_types';
import {getModelAnnotations} from '../../model';
import {
  collectAnnotations,
  annotationToTag,
} from '../../api/foundation/annotation';

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
  matchesAnnotation(result: AnnotationsDef, shouldBe: TstAnnotation) {
    function stripAt(a: AnnotationsDef): TstAnnotation {
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
    if (result === undefined) {
      return {
        pass: false,
        message: () => 'AnnotationsDef was undefined',
      };
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
      expect(note_a.annotations).matchesAnnotation(defaultTags);
    }
    const note_b = m.getSourceDef('note_b');
    expect(note_b).toBeDefined();
    if (note_b) {
      expect(note_b.annotations).matchesAnnotation({
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
      expect(note_a.annotations).matchesAnnotation({
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
      expect(note_a.annotations).matchesAnnotation({
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
      expect(note_a.annotations).matchesAnnotation(defaultTags);
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
      expect(note_a.annotations).matchesAnnotation({
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
      expect(note_a.annotations).matchesAnnotation({
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
      expect(note_a.annotations).matchesAnnotation({
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
    expect(note_a?.annotations).toBeDefined();
    expect(note_a?.annotations).matchesAnnotation({
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
    const model = m.translate()?.modelDef;
    expect(model).toBeDefined();
    const notes = model && model.modelAnnotations[model.modelID]?.ownNotes;
    expect(notes).matchesAnnotation({notes: ['## model1\n', '## model2\n']});
  });
  test('annotations and renamed fields', () => {
    const m = model`
      source: aplus is a extend {
        # from_inherit
        rename: _cost is af
      }
      source: inventory_items is aplus extend {
        # block
        rename:
          # b4name
        cost_prep is _cost
      }
    `;
    expect(m).toTranslate();
    const src = m.translator.getSourceDef('inventory_items');
    expect(src).toBeDefined();
    const cost_prep = getFieldDef(src!, 'cost_prep');
    expect(cost_prep).toBeDefined();
    expect(cost_prep!.annotations).matchesAnnotation({
      inherits: {blockNotes: ['# from_inherit\n']},
      notes: ['# b4name\n'],
      blockNotes: ['# block\n'],
    });
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
    `).toLog(errorMessage(/./));
  });
  test('checking compiler flags', () => {
    const m = model`
      ##! flagThis
    `;
    expect(m).toTranslate();
    expect(m.translator.getCompilerFlags().has('flagThis')).toBeTruthy();
  });
  test('extended models fold in the base model annotations', () => {
    const first = model`## from=1\n`;
    expect(first).toTranslate();
    const firstModel = first.translator.translate()?.modelDef;
    expect(firstModel).toBeDefined();
    // Real `extendModel` compiles the extension under a fresh URL, so base and
    // extension have distinct modelIDs. Every TestTranslator shares one URL, so
    // re-key the base to a standalone identity (its own `##`, no predecessors)
    // and model the real case.
    const baseID = 'internal://test/langtests/base.malloy';
    firstModel!.modelAnnotations = {
      [baseID]: {
        ownNotes: firstModel!.modelAnnotations[firstModel!.modelID].ownNotes,
        inheritsFrom: [],
      },
    };
    firstModel!.modelID = baseID;
    const second = model`## from=2\n`;
    second.translator.internalModel = firstModel!;
    const secondModel = second.translator.translate()?.modelDef;
    // The extend-base's `##` rides the `inheritsFrom` edge, not `ownNotes`, so
    // it surfaces only through the fold — base first, then this model's own.
    expect(secondModel && getModelAnnotations(secondModel)).matchesAnnotation({
      inherits: {notes: ['## from=1\n']},
      notes: ['## from=2\n'],
    });
  });
});
describe('model annotation cross-file fold', () => {
  const CHILD = 'internal://test/langtests/child';
  const MID = 'internal://test/langtests/mid';

  /** Compile `main` importing the given files, and return the running model's
   *  folded `##` — the one bundle every object in the model reports. Running
   *  real multi-file compilation proves the wiring the unit tests assume:
   *  `import` records the predecessor edge and merges the closure. */
  function foldOf(main: string, urls: Record<string, string>): AnnotationsDef {
    const t = new TestTranslator(main);
    t.update({urls});
    expect(t).toTranslate();
    return getModelAnnotations(t.translate().modelDef!);
  }

  test("an importer's `##` folds after the imported model's (local wins)", () => {
    expect(
      foldOf('import "child"\n## -flag\n', {[CHILD]: '## flag\n'})
    ).matchesAnnotation({
      inherits: {notes: ['## flag\n']},
      notes: ['## -flag\n'],
    });
  });

  test('an imported model `##` comes through when the importer has none', () => {
    expect(
      foldOf('import "child"\nsource: x is a', {[CHILD]: '## theme=foo\n'})
    ).matchesAnnotation({notes: ['## theme=foo\n']});
  });

  test('transitive import folds the whole chain, ancestral first', () => {
    expect(
      foldOf('import "mid"\n## main\n', {
        [MID]: 'import "child"\n## mid\n',
        [CHILD]: '## child\n',
      })
    ).matchesAnnotation({
      inherits: {inherits: {notes: ['## child\n']}, notes: ['## mid\n']},
      notes: ['## main\n'],
    });
  });
});
describe('source definition annotations', () => {
  test('turtle multi-line annotation', () => {
    const m = new TestTranslator(turtleDef);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    if (na) {
      const note_a = getFieldDef(na, 'note_a');
      expect(note_a).toBeDefined();
      expect(note_a.annotations).matchesAnnotation(defaultTags);
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
      expect(note_a?.annotations).toBeDefined();
      expect(note_a.annotations).matchesAnnotation({inherits: defaultTags});
    }
  });
  test('dimension multi-line annotation', () => {
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
    }
  });
  test('measure multi-line annotation', () => {
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
    }
  });
  test('join_one-with multi-line annotation', () => {
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
    }
  });
  test('join_many-on multi-line annotation', () => {
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
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
  test('outputStruct has annotation', () => {
    const m = new TestTranslator(`
      run: a -> {
        select:
          # note
          note_a is astr
      }
    `);
    expect(m).toTranslate();
    const query = m.getQuery(0);
    expect(query).toBeDefined();
    if (query) {
      const segment = query.pipeline[0];
      if ('outputStruct' in segment) {
        const outputField = getFieldDef(segment.outputStruct, 'note_a');
        expect(outputField.annotations).matchesAnnotation({
          notes: ['# note\n'],
        });
      } else {
        throw new Error('Expected segment to have outputStruct');
      }
    }
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
    }
  });
  test('select: ref inherits annotation', () => {
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
      expect(note_a?.annotations).matchesAnnotation({
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
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
      expect(note_a?.annotations).matchesAnnotation({
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
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
      expect(note_a?.annotations).matchesAnnotation({
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
      expect(note_a?.annotations).matchesAnnotation(defaultTags);
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
      expect(note_b?.annotations).matchesAnnotation({inherits: defaultTags});
    }
  });
  test('bare group_by annotation survives a refined nest', () => {
    // Same shape as 'group_by ref inherits' above, but the group_by lives in a
    // view reached through a nest. Its annotation must survive `+ {…}`
    // refinement, landing in the same slots as an unrefined nest (issue #2979).
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
        view: base is {
          # note1
          group_by:
          # note2
          note_a
          aggregate: c is count()
        }
      }
      run: aa -> { nest: plain   is base }
      run: aa -> { nest: refined is base + { limit: 10 } }
    `);
    expect(m).toTranslate();
    for (const [i, nestName] of [
      [0, 'plain'],
      [1, 'refined'],
    ] as const) {
      const q = m.getQuery(i);
      expect(q).toBeDefined();
      if (q) {
        const nest = getQueryFieldDef(q.pipeline[0], nestName);
        expect(nest.type).toBe('turtle');
        if (nest.type === 'turtle') {
          const note_a = getQueryFieldDef(nest.pipeline[0], 'note_a');
          expect(note_a?.annotations).matchesAnnotation({
            blockNotes: ['# note1\n'],
            inherits: defaultTags,
            notes: ['# note2\n'],
          });
        }
      }
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
      expect(note_b?.annotations).matchesAnnotation({inherits: defaultTags});
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
      expect(astr?.annotations).matchesAnnotation({
        inherits: {blockNotes: ['# noted\n']},
        notes: ['# note\n'],
      });
    }
  });
  describe('include annotations', () => {
    test('inherit: star', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # ai
          *
        }
      `);
      expect(m).toTranslate();
      const na = m.getSourceDef('na');
      expect(na).toBeDefined();
      if (na) {
        const ai = getFieldDef(na, 'ai');
        expect(ai?.annotations).matchesAnnotation({
          blockNotes: [],
          notes: ['# ai\n'],
        });
      }
    });
    test('new tags are inherited, not added', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # ai
          ai
        } include {
          # ai_2
          ai
        }
      `);
      expect(m).toTranslate();
      const na = m.getSourceDef('na');
      expect(na).toBeDefined();
      if (na) {
        const ai = getFieldDef(na, 'ai');
        expect(ai?.annotations).matchesAnnotation({
          blockNotes: [],
          notes: ['# ai_2\n'],
          inherits: {notes: ['# ai\n'], blockNotes: []},
        });
      }
    });
    test('modifier: star', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # ai_a
          public:
            # ai_b
            *
        }
      `);
      expect(m).toTranslate();
      const na = m.getSourceDef('na');
      expect(na).toBeDefined();
      if (na) {
        const ai = getFieldDef(na, 'ai');
        expect(ai?.annotations).matchesAnnotation({
          blockNotes: ['# ai_a\n'],
          notes: ['# ai_b\n'],
        });
      }
    });
    test('inherit: list', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # ai
          ai
          af
        }
      `);
      expect(m).toTranslate();
      const na = m.getSourceDef('na');
      expect(na).toBeDefined();
      if (na) {
        const ai = getFieldDef(na, 'ai');
        expect(ai?.annotations).matchesAnnotation({
          blockNotes: [],
          notes: ['# ai\n'],
        });
        const af = getFieldDef(na, 'af');
        expect(af).toBeDefined();
        expect(af?.annotations).toBeUndefined();
      }
    });
    test('modifier: list', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # a
          public:
            # ai
            ai
            af
        }
      `);
      expect(m).toTranslate();
      const na = m.getSourceDef('na');
      expect(na).toBeDefined();
      if (na) {
        const ai = getFieldDef(na, 'ai');
        expect(ai?.annotations).matchesAnnotation({
          blockNotes: ['# a\n'],
          notes: ['# ai\n'],
        });
        const af = getFieldDef(na, 'af');
        expect(af?.annotations).matchesAnnotation({
          blockNotes: ['# a\n'],
          notes: [],
        });
      }
    });
    test('tags except: list', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # error_1
          except:
            # error_2
            ai
        }
      `);
      expect(m).toLog(
        warningMessage('Tags on `except:` are ignored'),
        warningMessage('Tags on `except:` are ignored')
      );
    });
    test('tags except: star', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          # error_1
          except:
            # error_2
            *
        }
      `);
      expect(m).toLog(
        warningMessage('Tags on `except:` are ignored'),
        warningMessage('Tags on `except:` are ignored')
      );
    });
    test('oprhaned annotation', () => {
      const m = new TestTranslator(`
        ##! experimental.access_modifiers
        source: na is a include {
          ai
          ${'# orphaned'}
        }
      `);
      expect(m).toLog(warningMessage('This tag is not attached to anything'));
    });
  });
});
describe('multi-line annotations', () => {
  test('simple object multi-line annotation', () => {
    const m = new TestTranslator(`
      #|
        content line
      |#
      source: na is a
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|\ncontent line'],
    });
  });
  test('simple model multi-line annotation', () => {
    const m = new TestTranslator(`
      ##|
        model content
      |##
    `);
    expect(m).toTranslate();
    const md = m.translate()?.modelDef;
    expect(md).toBeDefined();
    expect(md!.modelAnnotations[md!.modelID]?.ownNotes).matchesAnnotation({
      notes: ['##|\nmodel content'],
    });
  });
  test('empty multi-line annotation', () => {
    const m = new TestTranslator(`
      #|
      |#
      source: na is a
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|'],
    });
  });
  test('multi-line annotation with routing', () => {
    const m = new TestTranslator(`
      #|(markdown)
        content
      |#
      source: na is a
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|(markdown)\ncontent'],
    });
  });
  test('multi-line annotation at column 0', () => {
    const m = new TestTranslator(
      '#|\nline one\nline two\n|#\nsource: na is a\n'
    );
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|\nline one\nline two'],
    });
  });
  test('CRLF multi-line annotation normalizes to LF note text', () => {
    // Windows line endings: the lexer keeps the \r in token text; the note
    // must come out byte-identical to the LF version above (internal \r and the
    // trailing \r\n both gone), so an annotation does not depend on EOL style.
    const m = new TestTranslator(
      '#|\r\nline one\r\nline two\r\n|#\r\nsource: na is a\r\n'
    );
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|\nline one\nline two'],
    });
  });
  test('CRLF single-line annotation normalizes to LF (trailing newline kept)', () => {
    const m = new TestTranslator('## modelNote\r\nsource: na is a\r\n');
    expect(m).toTranslate();
    const md = m.translate()?.modelDef;
    expect(md).toBeDefined();
    expect(md!.modelAnnotations[md!.modelID]?.ownNotes).matchesAnnotation({
      notes: ['## modelNote\n'],
    });
  });
  test('indented closer must match opener column', () => {
    const m = new TestTranslator(`
      #|
        content
          |# not a closer
        more content
      |#
      source: na is a
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    // Body lines share 8 leading spaces; the deeper `|#` line keeps its
    // extra 2 spaces of relative indent.
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|\ncontent\n  |# not a closer\nmore content'],
    });
  });
  test('|# in middle of line is not a closer', () => {
    const m = new TestTranslator(`
      #|
        some |# text
      |#
      source: na is a
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|\nsome |# text'],
    });
  });
  test('mixed single-line and multi-line annotations', () => {
    const m = new TestTranslator(`
      # single
      #|
        block content
      |#
      source: na is a
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['# single\n', '#|\nblock content'],
    });
  });
  test('unclosed multi-line annotation', () => {
    expect(`
      #|
        no closer
      source: na is a
    `).toLog(
      errorMessage(
        'Multi-line annotation is not closed, add correctly indented "|#"'
      )
    );
  });
  test('unclosed doc multi-line annotation', () => {
    expect(`
      ##|
        no closer
      source: na is a
    `).toLog(
      errorMessage(
        'Multi-line annotation is not closed, add correctly indented "|##"'
      )
    );
  });
  test('multi-line annotation on dimension', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        #|
        noted
        |#
        dimension: x is 1
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    const x = getFieldDef(na!, 'x');
    expect(x.annotations).matchesAnnotation({
      blockNotes: ['#|\nnoted'],
    });
  });
  // The body lines share 12 leading spaces; all 12 are stripped — including
  // any "extra" indent beyond the opener. The dedent rule cares about what
  // body lines share, not the opener's column.
  test('dedent strips the common leading prefix of body lines', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        #|
            line one
            line two
        |#
        dimension: x is 1
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    const x = getFieldDef(na!, 'x');
    expect(x.annotations).matchesAnnotation({
      blockNotes: ['#|\nline one\nline two'],
    });
  });
  test('dedent preserves relative indent past the common prefix', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        #|
          outer
            inner
          outer
        |#
        dimension: x is 1
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    const x = getFieldDef(na!, 'x');
    expect(x.annotations).matchesAnnotation({
      blockNotes: ['#|\nouter\n  inner\nouter'],
    });
  });
  test('blank lines do not constrain the common prefix', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        #|
          line one

          line two
        |#
        dimension: x is 1
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    const x = getFieldDef(na!, 'x');
    expect(x.annotations).matchesAnnotation({
      blockNotes: ['#|\nline one\n\nline two'],
    });
  });
  // The point of switching to Python-style dedent: pasting flush-left code
  // inside a multi-line annotation no longer warns and no longer mangles the body.
  // The shortest non-blank line wins the common prefix (here, 0).
  test('flush-left content among indented body produces zero strip', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        #|
          line one
flush left line
          line three
        |#
        dimension: x is 1
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    const x = getFieldDef(na!, 'x');
    expect(x.annotations).matchesAnnotation({
      blockNotes: [
        '#|\n          line one\nflush left line\n          line three',
      ],
    });
  });
  test('tabs and spaces mix limits the common prefix', () => {
    const m = new TestTranslator(`
      source: na is a extend {
        #|
\tcontent
        more content
        |#
        dimension: x is 1
      }
    `);
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    const x = getFieldDef(na!, 'x');
    // Tab vs spaces share no leading-WS prefix → no stripping, no warning.
    expect(x.annotations).matchesAnnotation({
      blockNotes: ['#|\n\tcontent\n        more content'],
    });
  });
  test('opener at column 0 still dedents body by common prefix', () => {
    const m = new TestTranslator(
      '#|\n    indented content\n|#\nsource: na is a\n'
    );
    expect(m).toTranslate();
    const na = m.getSourceDef('na');
    expect(na).toBeDefined();
    expect(na!.annotations).matchesAnnotation({
      blockNotes: ['#|\nindented content'],
    });
  });
});

describe('user type annotation', () => {
  const experimental = '##! experimental.virtual_source\n';

  function userTypeModel(src: string) {
    return new TestTranslator(experimental + src);
  }

  test('annotation on user type and fields', () => {
    const m = userTypeModel(`
      # struct note
      type:
      # def note
      Noted is {
        # field note
        name :: string,
        age :: number
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('Noted');
    expect(shape!.annotations).matchesAnnotation({
      blockNotes: ['# struct note\n'],
      notes: ['# def note\n'],
    });
    expect(shape!.fields[0].annotations).matchesAnnotation({
      notes: ['# field note\n'],
    });
    expect(shape!.fields[1].annotations).toBeUndefined();
  });

  test('annotation inherited from referenced user type', () => {
    const m = userTypeModel(`
      # base note
      type: Base is { x :: string }
      type: Wrapper is {
        data :: Base
      }
    `);
    expect(m).toTranslate();
    const wrapper = m.getUserTypeDef('Wrapper');
    expect(wrapper!.fields[0].annotations).matchesAnnotation({
      inherits: {
        blockNotes: ['# base note\n'],
      },
    });
  });

  test('field annotation merged with inherited user type annotation', () => {
    const m = userTypeModel(`
      # base note
      type: Base is { x :: string }
      type: Wrapper is {
        # field note
        data :: Base
      }
    `);
    expect(m).toTranslate();
    const wrapper = m.getUserTypeDef('Wrapper');
    expect(wrapper!.fields[0].annotations).matchesAnnotation({
      notes: ['# field note\n'],
      inherits: {
        blockNotes: ['# base note\n'],
      },
    });
  });

  test('field annotations preserved when :: applies user type to virtual source', () => {
    const m = userTypeModel(`
        type: S is {
          # noted field
          astr :: string
        }
        source: v is _db_.virtual('t')::S
      `);
    expect(m).toTranslate();
    const src = m.getSourceDef('v')!;
    const field = src.fields.find(f => f.name === 'astr')!;
    expect(field.annotations).matchesAnnotation({
      notes: ['# noted field\n'],
    });
  });

  test('user type field annotations applied to table source fields', () => {
    const m = userTypeModel(`
      type: S is {
        # currency
        astr :: string
      }
      source: typed is a::S
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('typed')!;
    const field = src.fields.find(f => f.name === 'astr')!;
    expect(field.annotations).matchesAnnotation({
      notes: ['# currency\n'],
    });
  });

  test('user type annotation merges with existing field annotation', () => {
    const m = userTypeModel(`
      type: S1 is {
        # from s1
        astr :: string
      }
      type: S2 is {
        # from s2
        astr :: string
      }
      source: src1 is _db_.virtual('t')::S1
      source: src2 is src1::S2
    `);
    expect(m).toTranslate();
    const src = m.getSourceDef('src2')!;
    const field = src.fields.find(f => f.name === 'astr')!;
    expect(field.annotations).matchesAnnotation({
      notes: ['# from s1\n'],
      inherits: {
        notes: ['# from s2\n'],
      },
    });
  });
});

describe('collectAnnotations (route-based)', () => {
  const at: Note['at'] = {
    url: 'test://x',
    range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
  };
  const note = (text: string): Note => ({text, at});

  test('no route returns every annotation, each carrying its route', () => {
    const annote: AnnotationsDef = {
      notes: [note('# tag1'), note('#(docs) hello'), note('#! flag')],
    };
    expect(collectAnnotations(annote).map(a => a.route)).toEqual([
      '',
      'docs',
      '!',
    ]);
  });

  test('a route filters to that route and omits route from results', () => {
    const annote: AnnotationsDef = {
      notes: [note('#(docs) one'), note('# tag'), note('#(docs) two')],
    };
    const docs = collectAnnotations(annote, 'docs');
    expect(docs.map(a => a.content)).toEqual(['one', 'two']);
    // The filtered form still echoes the route — same RoutedNote shape.
    expect(docs.every(a => a.route === 'docs')).toBe(true);
  });

  test('a malformed prefix is excluded from its route query, present in all', () => {
    // `#docs` (no brackets) is malformed; its best-effort route is still 'docs'.
    const annote: AnnotationsDef = {notes: [note('#docs'), note('#(docs) ok')]};
    const docs = collectAnnotations(annote, 'docs');
    expect(docs.map(a => a.text)).toEqual(['#(docs) ok']);
    expect(collectAnnotations(annote).map(a => a.text)).toContain('#docs');
  });

  test('inherited annotations come first', () => {
    const parent: AnnotationsDef = {notes: [note('#(docs) parent')]};
    const child: AnnotationsDef = {
      inherits: parent,
      notes: [note('#(docs) child')],
    };
    expect(collectAnnotations(child, 'docs').map(a => a.content)).toEqual([
      'parent',
      'child',
    ]);
  });

  test('undefined annotation yields nothing', () => {
    expect(collectAnnotations(undefined)).toEqual([]);
    expect(collectAnnotations(undefined, 'docs')).toEqual([]);
  });

  test('annotationToTag parses the requested route as MOTLY', () => {
    const annote: AnnotationsDef = {
      notes: [note('# size=large'), note('#(viz) chart=bar')],
    };
    expect(annotationToTag(annote).tag.text('size')).toBe('large');
    expect(annotationToTag(annote).tag.text('chart')).toBeUndefined();
    expect(annotationToTag(annote, 'viz').tag.text('chart')).toBe('bar');
    expect(annotationToTag(annote, 'viz').tag.text('size')).toBeUndefined();
  });
});

describe('route warnings', () => {
  test('bare-word object prefix warns malformed-route once', () => {
    expect(`
      source: na is a extend {
        #malformed
        dimension: x is 1
      }
    `).toLog(warning('malformed-route', {prefix: '#malformed'}));
  });

  test('bare-word model prefix warns malformed-route', () => {
    expect('##malformed\nsource: na is a\n').toLog(
      warning('malformed-route', {prefix: '##malformed'})
    );
  });

  test('unclosed bracket warns malformed-route', () => {
    expect(`
      source: na is a extend {
        #(docs
        dimension: x is 1
      }
    `).toLog(warning('malformed-route', {prefix: '#(docs'}));
  });

  test('unclaimed sigil warns reserved-route', () => {
    expect(`
      source: na is a extend {
        #% nope
        dimension: x is 1
      }
    `).toLog(warning('reserved-route', {prefix: '#%'}));
  });

  test('well-formed prefixes do not warn', () => {
    expect(`
      ##! flag
      source: na is a extend {
        # tag
        #(docs) hello
        #! flag2
        #@ persist
        #" desc
        dimension: x is 1
      }
    `).toTranslate();
  });

  // The dedup case: a block-level note attaches to every item inside the
  // block, but is constructed once at the parse site — so we must warn once,
  // not N times. Three malformed prefixes in source → exactly three warnings.
  test('block-level note dedups to one warning per source annotation', () => {
    expect(`
      source: na is a extend {
        #malformed
        dimension:
          #mf2
          x is 1
          #mf3
          y is 2
      }
    `).toLog(
      // The block-level note (`#malformed`) is emitted after the inner items
      // because the AST builder visits inner item annotations first, then
      // assembles the block-level annotation list.
      warning('malformed-route', {prefix: '#mf2'}),
      warning('malformed-route', {prefix: '#mf3'}),
      warning('malformed-route', {prefix: '#malformed'})
    );
  });

  test('multi-line annotation with malformed route warns once', () => {
    expect(`
      source: na is a extend {
        #|malformed
        body
        |#
        dimension: x is 1
      }
    `).toLog(warning('malformed-route', {prefix: '#|malformed'}));
  });

  // `inherits` is populated when a child source has its own notes AND extends
  // a parent source: `define-source.ts` does
  // `entry.annotations = {...this.note, inherits: structDef.annotations}`.
  // The inherited Notes never re-flow through getAnnotation, so the warning
  // fires only at the parse site even though the malformed Note ends up
  // reachable from child.annotations.inherits.
  test('extend populates `inherits`; malformed parent note warns once', () => {
    const m = new TestTranslator(`
      #malformed_parent
      source: parent is a extend { dimension: x is 1 }

      # good_child
      source: child is parent extend { dimension: y is 2 }
    `);
    m.translate();
    // Exactly one problem total — the parent-site warning — even though the
    // malformed Note is also reachable through child.annotations.inherits.
    expect(m.problemResponse().problems).toEqual([
      expect.objectContaining({
        code: 'malformed-route',
        severity: 'warn',
        data: {prefix: '#malformed_parent'},
      }),
    ]);
    // And inherits is in fact populated — the malformed note is reachable
    // through child.annotations.inherits, proving the chain is live.
    const child = m.getSourceDef('child');
    expect(child!.annotations).matchesAnnotation({
      blockNotes: ['# good_child\n'],
      inherits: {blockNotes: ['#malformed_parent\n']},
    });
  });
});

describe('tab-separated annotations round-trip to MOTLY', () => {
  // parsePrefix accepts space, tab, CR, and LF as the prefix/content boundary;
  // malloy-tag's stripPrefix must agree, or a tab-separated annotation gets
  // selected for a route but its payload is silently dropped before MOTLY
  // sees it.
  const at: Note['at'] = {
    url: 'test://x',
    range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
  };
  test('tab after marker — empty route, MOTLY parses payload', () => {
    const annote: AnnotationsDef = {notes: [{text: '#\tfoo=true\n', at}]};
    expect(annotationToTag(annote).tag.has('foo')).toBe(true);
  });
  test('tab after sigil route — `!` route, MOTLY parses payload', () => {
    const annote: AnnotationsDef = {notes: [{text: '##!\tflag=on\n', at}]};
    expect(annotationToTag(annote, '!').tag.text('flag')).toBe('on');
  });
});

describe('mapMalloyError body-line column', () => {
  // Construct a multi-line annotation by hand and assert tag-parse error columns
  // map back to source correctly. The opener is at line 5 column 4; the body
  // line was at column 10 in source; dedent stripped 6 chars. So any
  // body-line error must land at column 6 + parser_offset.
  test('body-line errors land at indentStripped + parser_offset', () => {
    const note: Note = {
      text: '#|\n=oops',
      at: {
        url: 'test://x',
        range: {
          start: {line: 5, character: 4},
          end: {line: 5, character: 6},
        },
      },
      indentStripped: 6,
    };
    const annote: AnnotationsDef = {notes: [note]};
    const errs = annotationToTag(annote).log.filter(
      l => l.code === 'tag-parse-error'
    );
    expect(errs.length).toBeGreaterThan(0);
    const e = errs[0];
    expect(e.at?.range.start.line).toBe(6);
    // `=` is at IR-line offset 0; source col = indentStripped (6) + 0.
    expect(e.at?.range.start.character).toBe(6);
  });
});
