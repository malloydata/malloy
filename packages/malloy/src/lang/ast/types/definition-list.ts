/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef} from '../../../model';
import type {MalloyElement} from './malloy-element';
import {ListOf} from './malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteHelper, isNoteable} from '../types/noteable';

export abstract class DefinitionList<DT extends MalloyElement>
  extends ListOf<DT>
  implements Noteable
{
  readonly isNoteableObj = true;
  note?: AnnotationsDef;

  extendNote(ext: Partial<AnnotationsDef>) {
    extendNoteHelper(this, ext);
    this.distributeAnnotation();
  }

  distributeAnnotation() {
    if (this.note) {
      for (const el of this.elements) {
        if (isNoteable(el)) {
          el.extendNote(this.note);
        }
      }
    }
  }

  protected newContents(): void {
    super.newContents();
    this.distributeAnnotation();
  }
}
