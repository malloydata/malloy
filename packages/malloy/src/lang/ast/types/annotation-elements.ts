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

import type {Note} from '../../../model/malloy_types';
import type {Tag} from '@malloydata/malloy-tag';
import type {MessageLogger} from '../../parse-log';
import type {Document, DocStatement} from './malloy-element';
import {MalloyElement} from './malloy-element';
import type {QueryPropertyInterface} from './query-property-interface';
import {annotationToTag} from '../../../annotation';

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

  getCompilerFlags(existing: Tag, logTo: MessageLogger): Tag {
    const tagParse = annotationToTag(
      {notes: this.notes},
      {
        prefix: /^##! /,
        extending: existing,
      }
    );
    tagParse.log.forEach(err => logTo.log(err));
    return tagParse.tag;
  }

  execute(doc: Document): void {
    if (doc.annotation.notes === undefined) {
      doc.annotation.notes = [];
    }
    doc.annotation.notes.push(...this.notes);
  }
}
