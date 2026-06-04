/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {getModelAnnotations, notesInOrder} from '../annotation_utils';
import {mkModelDef} from '../utils';
import type {
  ModelAnnotationEntry,
  ModelDef,
  ModelID,
  Note,
} from '../malloy_types';

const AT = {
  url: 'test',
  range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
};
function note(text: string): Note {
  return {text, at: AT};
}

/** A model-annotation entry: a model's own `##` plus its direct predecessors. */
function entry(
  own: string[],
  inheritsFrom: ModelID[] = []
): ModelAnnotationEntry {
  return {ownNotes: {notes: own.map(note)}, inheritsFrom};
}

function modelWith(
  modelID: ModelID,
  entries: Record<ModelID, ModelAnnotationEntry>
): ModelDef {
  const m = mkModelDef('m', modelID);
  m.modelAnnotations = entries;
  return m;
}

/** Fold a model's annotations and flatten the result to note texts, in order. */
function foldTexts(model: ModelDef, modelID?: ModelID): string[] {
  return [...notesInOrder(getModelAnnotations(model, modelID))].map(n => n.text);
}

describe('getModelAnnotations fold', () => {
  test('a single model with no predecessors folds to its own `##`', () => {
    const model = modelWith('F', {F: entry(['## t=1\n'])});
    expect(foldTexts(model)).toEqual(['## t=1\n']);
  });

  test("an importer's `##` folds after the imported model's (local wins)", () => {
    // child: `## flag`; main imports child and adds `## -flag`. Imports-first /
    // local-last, so re-parsing the folded notes lets `-flag` win.
    const model = modelWith('main', {
      child: entry(['## flag\n']),
      main: entry(['## -flag\n'], ['child']),
    });
    expect(foldTexts(model)).toEqual(['## flag\n', '## -flag\n']);
  });

  test('an imported model `##` comes through even when the importer has none', () => {
    const model = modelWith('main', {
      child: entry(['## theme=foo\n']),
      main: entry([], ['child']),
    });
    expect(foldTexts(model)).toEqual(['## theme=foo\n']);
  });

  test('diamond: a shared model is deduped to its most-ancestral slot', () => {
    // A imports B and C; both import D. D must appear once, ahead of B and C.
    const model = modelWith('A', {
      A: entry(['## a\n'], ['B', 'C']),
      B: entry(['## b\n'], ['D']),
      C: entry(['## c\n'], ['D']),
      D: entry(['## d\n']),
    });
    // scope(A): D folded once (keep-first), then B, C, then A's own.
    expect(foldTexts(model)).toEqual(['## d\n', '## b\n', '## c\n', '## a\n']);
    // scope(B), independently, is just D then B.
    expect(foldTexts(model, 'B')).toEqual(['## d\n', '## b\n']);
  });

  test('extend chain: the extend-base is import₀, and its own imports come first', () => {
    // cell0 imports y; cell1 imports x and extends cell0. The extend-base
    // (cell0) is cell1's first predecessor, so cell1 folds to
    // [y, cell0, x, cell1] — the base's own import (y) ahead of everything.
    const model = modelWith('cell1', {
      y: entry(['## y\n']),
      cell0: entry(['## cell0\n'], ['y']),
      x: entry(['## x\n']),
      cell1: entry(['## cell1\n'], ['cell0', 'x']),
    });
    expect(foldTexts(model)).toEqual([
      '## y\n',
      '## cell0\n',
      '## x\n',
      '## cell1\n',
    ]);
  });

  test('the default root is the model itself', () => {
    const model = modelWith('me', {
      base: entry(['## base\n']),
      me: entry(['## me\n'], ['base']),
    });
    expect(getModelAnnotations(model)).toEqual(
      getModelAnnotations(model, 'me')
    );
  });

  test('a missing closure entry is a loud compiler-bug-class error', () => {
    // An edge to a model with no entry — the one place that needs it detects it.
    const dangling = modelWith('m', {m: entry([], ['ghost'])});
    expect(() => getModelAnnotations(dangling)).toThrow(/no entry in model/);
    // ...as is asking for a root that isn't in the closure at all.
    const present = modelWith('m', {m: entry(['## here\n'])});
    expect(() => getModelAnnotations(present, 'absent')).toThrow(
      /no entry in model/
    );
  });
});
