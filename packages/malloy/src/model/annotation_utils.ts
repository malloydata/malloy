/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AnnotationsDef,
  ModelAnnotationsDef,
  ModelDef,
  ModelID,
  Note,
  ObjectAnnotationsDef,
} from './malloy_types';

function isObjectAnnotation(n: AnnotationsDef): n is ObjectAnnotationsDef {
  return 'fromModel' in n;
}

/**
 * Every Note of an annotation bundle, inherited first, in document order
 * (`inherits` → `blockNotes` → `notes`). Later notes win when re-parsed.
 *
 * Internal helper — not part of the public `model` barrel. The public way to
 * read notes is the `Annotations` view (`api/foundation/annotation.ts`), which
 * uses this; the model-annotation resolver below uses it too.
 */
export function* notesInOrder(annote: AnnotationsDef): Generator<Note> {
  if (annote.inherits) yield* notesInOrder(annote.inherits);
  if (annote.blockNotes) yield* annote.blockNotes;
  if (annote.notes) yield* annote.notes;
}

/**
 * Resolve the model (`##`) annotations that apply to one object, by walking the
 * object's annotation `inherits` chain, collecting the model each node came
 * from (`fromModel`), and folding those models' annotation bundles.
 *
 * Fold order is imports-first / local-last so last-wins falls out of note
 * order; a model is deduped to its first (most ancestral) appearance. The
 * running model's own `##` always applies and, being most local, wins. Each
 * model's bundle is flattened along its own `inherits` chain (the extend
 * lineage). `annote` may be undefined (e.g. a run-head with no object
 * annotations), in which case only the running model's own `##` applies.
 */
export function resolveModelAnnotations(
  model: ModelDef,
  annote?: ObjectAnnotationsDef
): ModelAnnotationsDef {
  // Most-local first: the running model (whose `##` wins), then the object's
  // annotation chain walked outward (local → ancestral).
  const localToAncestral: ModelID[] = [model.modelID];
  for (let n: AnnotationsDef | undefined = annote; n; n = n.inherits) {
    if (isObjectAnnotation(n)) localToAncestral.push(n.fromModel);
  }
  // Fold imports-first / local-last: walk ancestral → local, keeping each
  // model's most-ancestral slot (first occurrence in that order). Reading the
  // folded notes in this order makes the most-local model's `##` win.
  const foldOrder: ModelID[] = [];
  const seen = new Set<ModelID>();
  for (let i = localToAncestral.length - 1; i >= 0; i--) {
    const id = localToAncestral[i];
    if (!seen.has(id)) {
      seen.add(id);
      foldOrder.push(id);
    }
  }
  const notes: Note[] = [];
  for (const id of foldOrder) {
    const bundle = model.modelAnnotationsByID[id];
    if (bundle) notes.push(...notesInOrder(bundle));
  }
  return {notes};
}
