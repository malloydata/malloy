/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef} from '../../../model';
import type {MalloyElement} from './malloy-element';
import {ListOf} from './malloy-element';
import type {Noteable} from '../types/noteable';
import {extendOwnAnnotation, isNoteable} from '../types/noteable';

export abstract class DefinitionList<DT extends MalloyElement>
  extends ListOf<DT>
  implements Noteable
{
  readonly isNoteableObj = true;
  ownAnnotation?: AnnotationsDef;

  // Noteable hook: push this list's own (block) annotation down onto its
  // members. The block annotation is attached after construction, so it has
  // to distribute here, at attach time, rather than from the constructor.
  afterExtendAnnotation(): void {
    if (this.ownAnnotation) {
      for (const el of this.elements) {
        if (isNoteable(el)) {
          extendOwnAnnotation(el, this.ownAnnotation);
        }
      }
    }
  }
}
