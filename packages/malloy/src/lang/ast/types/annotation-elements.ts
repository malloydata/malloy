/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Note} from '../../../model/malloy_types';
import type {Document, DocStatement} from './malloy-element';
import {MalloyElement} from './malloy-element';
import type {QueryPropertyInterface} from './query-property-interface';

const COMPILER_FLAG_PREFIX = /^##! /;

export class ObjectAnnotation
  extends MalloyElement
  implements QueryPropertyInterface
{
  elementType = 'annotation';
  forceQueryClass = undefined;
  queryRefinementStage = undefined;

  constructor(readonly notes: Note[]) {
    super();
  }

  queryExecute() {}
}

export class ModelAnnotation extends ObjectAnnotation implements DocStatement {
  elementType = 'modelAnnotation';

  getCompilerFlagNotes(): Note[] {
    return this.notes.filter(note => note.text.match(COMPILER_FLAG_PREFIX));
  }

  getCompilerFlagLines(): string[] {
    return this.getCompilerFlagNotes().map(note => note.text);
  }

  execute(doc: Document): void {
    if (this.isRestricted()) {
      for (const note of this.getCompilerFlagNotes()) {
        const line = note.text.replace(/\n$/, '');
        this.logError(
          'restricted-construct-forbidden',
          `\`${line}\` cannot be used in a restricted query — compiler-flag annotations are not permitted.`,
          {at: note.at}
        );
      }
    }
    if (doc.annotations.notes === undefined) {
      doc.annotations.notes = [];
    }
    doc.annotations.notes.push(...this.notes);
  }
}
