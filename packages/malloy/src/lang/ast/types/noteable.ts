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
  note?: AnnotationsDef;
  extendNote(ext: Partial<AnnotationsDef>): void;
}

export function isNoteable(el: unknown): el is Noteable {
  return (el as Noteable).isNoteableObj;
}

export function extendNoteMethod(this: Noteable, ext: Partial<AnnotationsDef>) {
  extendNoteHelper(this, ext);
}

export function extendNoteHelper(to: Noteable, ext: Partial<AnnotationsDef>) {
  if (
    (ext.notes && ext.notes.length > 0) ||
    (ext.blockNotes && ext.blockNotes.length > 0) ||
    ext.inherits !== undefined
  ) {
    to.note = {...to.note, ...ext};
  }
}
