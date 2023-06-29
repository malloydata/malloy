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
import {
  DocStatement,
  Document,
  MalloyElement,
  ModelEntryReference,
} from '../types/malloy-element';
import {Noteable, extendNoteMethod} from '../types/noteable';
import {QueryElement} from '../types/query-element';

abstract class RunQuery extends MalloyElement implements DocStatement {
  elementType = 'runQuery';

  abstract execute(doc: Document): void;
}

export class RunQueryDef extends RunQuery implements Noteable {
  note?: Annotation;
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  constructor(readonly theQuery: QueryElement) {
    super();
    this.has({query: theQuery});
  }

  execute(doc: Document): void {
    let modelQuery = this.theQuery.query();
    const annotation = this.note || {};
    if (modelQuery.annotation) {
      annotation.inherits = modelQuery.annotation;
    }
    if (annotation.notes || annotation.blockNotes || annotation.inherits) {
      modelQuery = {...modelQuery, annotation};
    }
    doc.queryList.push(modelQuery);
    return undefined;
  }
}

export class RunQueryRef extends RunQuery {
  constructor(readonly queryName: ModelEntryReference) {
    super();
    this.has({queryName});
  }

  execute(doc: Document): void {
    const found = doc.getEntry(this.queryName.refString);
    if (found === undefined) {
      this.queryName.log(`${this.queryName} is not defined`);
    }
    if (found.entry.type === 'query') {
      doc.queryList.push(found.entry);
      return undefined;
    } else {
      this.queryName.log(`${this.queryName} is not a query`);
    }
  }
}
