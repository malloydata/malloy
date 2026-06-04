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
 * predecessors and only once (its most-ancestral slot); back-edges are skipped,
 * so the walk terminates on a cycle. The result is ordered imports-first /
 * local-last — a consumer that takes "last wins" sees the target model's own
 * `##` win — and is returned as an {@link AnnotationsDef} whose `inherits` chain
 * *is* that order (target at the top, most-ancestral import deepest), so the
 * `Annotations` view / {@link notesInOrder} consume it with no new code.
 *
 * A target with no entry contributes nothing (empty) — the honest answer for a
 * synthetic or detached `ModelDef` (built via `mkModelDef`, a `pseudoModelFor`
 * struct, a model with no `##` anywhere) that never recorded a self-entry. But
 * a recorded `inheritsFrom` *edge* to a model with no entry is corruption —
 * population kept the edge but lost the target — and throws a compiler-bug-class
 * error: the one place that needs the entry is the one place that detects it.
 */
export function getModelAnnotations(
  model: ModelDef,
  modelID: ModelID = model.modelID
): AnnotationsDef {
  const order: ModelID[] = []; // ancestral-first, target last; deduped keep-first
  const entered = new Set<ModelID>(); // guards both re-folding and cycles
  const visit = (id: ModelID, viaEdge: boolean): void => {
    if (entered.has(id)) return; // already folded (diamond) or a back-edge cycle
    const entry = model.modelAnnotations[id];
    if (entry === undefined) {
      if (viaEdge) {
        throw new Error(
          `Internal error: model '${model.modelID}' has an inheritsFrom edge ` +
            `to '${id}', which has no entry in its closure (likely a compiler bug)`
        );
      }
      return; // target model has no annotations of its own — contribute nothing
    }
    entered.add(id);
    for (const pred of entry.inheritsFrom) visit(pred, true);
    order.push(id);
  };
  visit(modelID, false);
  // Build the output `inherits` chain bottom-up: most-ancestral deepest, target
  // at the top. `notesInOrder` then yields ancestral → local. Models that
  // contribute no notes of their own add no link — the chain carries only the
  // notes that exist, not an empty node per model in the lineage.
  let chain: AnnotationsDef | undefined = undefined;
  for (const id of order) {
    const own = model.modelAnnotations[id].ownNotes;
    if (!own.notes?.length && !own.blockNotes?.length) continue;
    chain = {notes: own.notes, blockNotes: own.blockNotes, inherits: chain};
  }
  return chain ?? {};
}
