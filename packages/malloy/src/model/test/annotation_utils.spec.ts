/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {resolveModelAnnotations} from '../annotation_utils';
import {mkModelDef} from '../utils';
import type {
  ModelAnnotationsDef,
  ModelDef,
  ModelID,
  Note,
  ObjectAnnotationsDef,
} from '../malloy_types';

const AT = {
  url: 'test',
  range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
};
function note(text: string): Note {
  return {text, at: AT};
}

function modelWith(
  modelID: ModelID,
  byID: Record<ModelID, ModelAnnotationsDef>
): ModelDef {
  const m = mkModelDef('m', modelID);
  m.modelAnnotationsByID = byID;
  return m;
}

function resolvedTexts(
  model: ModelDef,
  annote?: ObjectAnnotationsDef
): string[] {
  return (resolveModelAnnotations(model, annote).notes ?? []).map(n => n.text);
}

describe('resolveModelAnnotations fold order', () => {
  test("importer's `##` applies after the imported model's (local wins)", () => {
    // file1: `## flag`; file2 imports file1 and adds `## -flag`. An object
    // defined in file1, resolved in file2, must fold file1-then-file2 so
    // re-parsing the notes lets `-flag` win.
    const model = modelWith('file2', {
      file1: {notes: [note('## flag\n')]},
      file2: {notes: [note('## -flag\n')]},
    });
    const objectFromFile1: ObjectAnnotationsDef = {fromModel: 'file1'};
    expect(resolvedTexts(model, objectFromFile1)).toEqual([
      '## flag\n',
      '## -flag\n',
    ]);
  });

  test('linear cross-model chain folds ancestral → local', () => {
    // Object defined in C, refined in A, then B, then ME (the running model).
    const c: ObjectAnnotationsDef = {fromModel: 'C'};
    const a: ObjectAnnotationsDef = {fromModel: 'A', inherits: c};
    const b: ObjectAnnotationsDef = {fromModel: 'B', inherits: a};
    const me: ObjectAnnotationsDef = {fromModel: 'ME', inherits: b};
    const model = modelWith('ME', {
      C: {notes: [note('## c\n')]},
      A: {notes: [note('## a\n')]},
      B: {notes: [note('## b\n')]},
      ME: {notes: [note('## me\n')]},
    });
    expect(resolvedTexts(model, me)).toEqual([
      '## c\n',
      '## a\n',
      '## b\n',
      '## me\n',
    ]);
  });

  test('a model appears once even if it recurs in the chain', () => {
    // Object from C, used in ME, where C re-appears deeper in the chain.
    const cDeep: ObjectAnnotationsDef = {fromModel: 'C'};
    const me: ObjectAnnotationsDef = {fromModel: 'ME', inherits: cDeep};
    const cShallow: ObjectAnnotationsDef = {fromModel: 'C', inherits: me};
    const model = modelWith('ME', {
      C: {notes: [note('## c\n')]},
      ME: {notes: [note('## me\n')]},
    });
    const texts = resolvedTexts(model, cShallow);
    expect(texts.filter(t => t === '## c\n')).toHaveLength(1);
  });

  test('with no object annotation, only the running model applies', () => {
    const model = modelWith('only', {
      only: {notes: [note('## here\n')]},
      other: {notes: [note('## elsewhere\n')]},
    });
    expect(resolvedTexts(model)).toEqual(['## here\n']);
  });

  test('flattens each bundle along its own extend lineage', () => {
    // A model whose own `##` bundle extends a base bundle (notebook cell 2
    // extending cell 1): both notes appear, base first.
    const base: ModelAnnotationsDef = {notes: [note('## from=cell1\n')]};
    const model = modelWith('cell2', {
      cell2: {inherits: base, notes: [note('## from=cell2\n')]},
    });
    expect(resolvedTexts(model)).toEqual(['## from=cell1\n', '## from=cell2\n']);
  });
});
