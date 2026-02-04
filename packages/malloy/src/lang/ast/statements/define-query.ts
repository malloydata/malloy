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

import type {Annotation, NamedQueryDef} from '../../../model/malloy_types';

import type {DocStatement, Document} from '../types/malloy-element';
import {MalloyElement, DocStatementList} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import type {SourceQueryElement} from '../source-query-elements/source-query-element';

export class DefineQuery
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'defineQuery';

  constructor(
    readonly name: string,
    readonly queryExpr: SourceQueryElement
  ) {
    super({queryExpr});
  }

  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): void {
    const existing = doc.getEntry(this.name);
    if (existing) {
      this.logError(
        'query-definition-name-conflict',
        `'${this.name}' is already defined, cannot redefine`
      );
      return;
    }
    const queryEl = this.queryExpr.getQuery();
    if (!queryEl) {
      this.queryExpr.sqLog(
        'query-definition-from-non-query',
        'Cannot define a query from this expression'
      );
      return;
    }
    const entry: NamedQueryDef = {
      ...queryEl.query(),
      type: 'query',
      name: this.name,
      location: this.location,
    };
    if (this.note) {
      entry.annotation = entry.annotation
        ? {...this.note, inherits: entry.annotation}
        : this.note;
    }
    doc.setEntry(this.name, {entry, exported: true});
  }
}

export class DefineQueryList extends DocStatementList {
  elementType = 'defineQueries';
  constructor(queryList: DefineQuery[]) {
    super(queryList);
  }
}
