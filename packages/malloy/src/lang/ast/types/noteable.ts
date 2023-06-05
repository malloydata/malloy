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

import {Annotation} from '../../../model/malloy_types';

/**
 * An object which can receive annotations is "Noteable"
 */
export interface Noteable {
  isNoteableObj: true;
  note?: Annotation;
  extendNote(ext: Partial<Annotation>): void;
}

export function isNoteable(el: unknown): el is Noteable {
  return (el as Noteable).isNoteableObj;
}

export function extendNoteMethod(this: Noteable, ext: Partial<Annotation>) {
  extendNoteHelper(this, ext);
}

export function extendNoteHelper(to: Noteable, ext: Partial<Annotation>) {
  if (
    (ext.notes && ext.notes.length > 0) ||
    (ext.blockNotes && ext.blockNotes.length > 0)
  ) {
    to.note = {...to.note, ...ext};
  }
}
