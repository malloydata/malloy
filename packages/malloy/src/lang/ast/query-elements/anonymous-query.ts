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

import type {Annotation} from '../../../model';

import type {DocStatement, Document} from '../types/malloy-element';
import {MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import type {SourceQueryElement} from '../source-query-elements/source-query-element';

export class AnonymousQuery
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'anonymousQuery';

  constructor(readonly queryExpr: SourceQueryElement) {
    super();
    this.has({queryExpr});
  }

  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): void {
    const queryObj = this.queryExpr.getQuery();
    if (!queryObj) {
      this.queryExpr.sqLog(
        'non-query-used-as-query',
        'Cannot run this object as a query'
      );
      return;
    }
    const modelQuery = {...queryObj.query()};
    const annotation = this.note || {};
    if (modelQuery.annotation) {
      annotation.inherits = modelQuery.annotation;
    }
    if (annotation.notes || annotation.blockNotes || annotation.inherits) {
      modelQuery.annotation = annotation;
    }
    doc.queryList.push(modelQuery);
  }
}
