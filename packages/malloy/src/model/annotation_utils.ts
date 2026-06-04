/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AnnotationsDef,
  ModelDef,
  ModelID,
  Note,
} from './malloy_types';

/**
 * Every Note of an annotation bundle, inherited first, in document order
 * (`inherits` → `blockNotes` → `notes`). Later notes win when re-parsed.
 *
 * Internal helper — not part of the public `model` barrel. The public way to
 * read notes is the `Annotations` view (`api/foundation/annotation.ts`), which
 * uses this; the model-annotation fold below uses it too.
 */
export function* notesInOrder(annote: AnnotationsDef): Generator<Note> {
  if (annote.inherits) yield* notesInOrder(annote.inherits);
  if (annote.blockNotes) yield* annote.blockNotes;
  if (annote.notes) yield* annote.notes;
}

/**
 * The model (`##`) annotations for one model, compiled by walking the
 * annotation-provenance tree: a model's own `##` together with everything it
 * imports/extends, folded down the lineage into a single ordered bundle.
 *
 * `modelID` defaults to `model.modelID` — the common case, "the annotations
 * this model presents." `##` is model-level, so every object resolved in the
 * model reports this same one bundle (resolution takes no object). Pass an
 * explicit `modelID` to compile the bundle for any other model in the closure.
 *
 * Mechanism: a post-order DFS over each model's `inheritsFrom` edges
 * (extend-base is `import₀`, sitting first) emits a model only after its
 * predecessors and only once (its most-ancestral slot). The result is ordered
 * imports-first / local-last — a consumer that takes "last wins" sees the
 * target model's own `##` win — and is returned as an {@link AnnotationsDef}
 * whose `inherits` chain *is* that order (target at the top, most-ancestral
 * import deepest), so the `Annotations` view / {@link notesInOrder} consume it
 * with no new code.
 *
 * Throws a compiler-bug-class error if the target (or any model it inherits
 * from) has no entry in the closure: the one place that needs the entry is the
 * one place that detects its absence.
 */
export function getModelAnnotations(
  model: ModelDef,
  modelID: ModelID = model.modelID
): AnnotationsDef {
  const order: ModelID[] = []; // ancestral-first, target last; deduped keep-first
  const seen = new Set<ModelID>();
  const visit = (id: ModelID): void => {
    const entry = model.modelAnnotations[id];
    if (entry === undefined) {
      throw new Error(
        `Internal error: model annotations requested for '${id}', ` +
          `which has no entry in model '${model.modelID}' (likely a compiler bug)`
      );
    }
    for (const pred of entry.inheritsFrom) visit(pred);
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };
  visit(modelID);
  // Build the output `inherits` chain bottom-up: most-ancestral deepest, target
  // at the top. `notesInOrder` then yields ancestral → local.
  let chain: AnnotationsDef | undefined = undefined;
  for (const id of order) {
    const own = model.modelAnnotations[id].ownNotes;
    chain = {notes: own.notes, blockNotes: own.blockNotes, inherits: chain};
  }
  return chain ?? {};
}
