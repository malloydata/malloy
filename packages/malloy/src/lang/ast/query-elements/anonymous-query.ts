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

import {Annotation} from '../../../model';
import {ModelDataRequest} from '../../translate-response';

import {DocStatement, Document, MalloyElement} from '../types/malloy-element';
import {QueryElement} from '../types/query-element';
import {Noteable, extendNoteMethod} from '../types/noteable';
import {FullQuery} from './full-query';
import {SQLSource} from '../sources/sql-source';

export class AnonymousQuery
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'anonymousQuery';

  constructor(readonly theQuery: QueryElement) {
    super();
    this.has({query: theQuery});
  }

  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): ModelDataRequest {
    // TODO replace this with a more general way of getting needs
    if (
      this.theQuery instanceof FullQuery &&
      this.theQuery.explore instanceof SQLSource
    ) {
      const needs = this.theQuery.explore.needs(doc);
      if (needs) return needs;
    }
    const modelQuery = this.theQuery.query();
    if (this.note) {
      modelQuery.annotation = modelQuery.annotation
        ? {...this.note, inherits: modelQuery.annotation}
        : this.note;
    }
    doc.queryList.push(modelQuery);
    return undefined;
  }
}
