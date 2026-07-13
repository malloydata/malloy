/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef} from '../../../model/malloy_types';

/**
 * An object which can receive annotations is "Noteable"
 */
export interface Noteable {
  isNoteableObj: true;
  ownAnnotation?: AnnotationsDef;
  // Optional hook, run after this element's own annotation is extended.
  // Container elements (definition lists) implement it to push a block
  // annotation down onto their members; leaf elements leave it undefined.
  afterExtendAnnotation?(): void;
}

export function isNoteable(el: unknown): el is Noteable {
  return (el as Noteable).isNoteableObj;
}

export function extendOwnAnnotation(
  to: Noteable,
  ext: Partial<AnnotationsDef>
) {
  if (
    (ext.notes && ext.notes.length > 0) ||
    (ext.blockNotes && ext.blockNotes.length > 0) ||
    ext.inherits !== undefined
  ) {
    to.ownAnnotation = {...to.ownAnnotation, ...ext};
    to.afterExtendAnnotation?.();
  }
}
