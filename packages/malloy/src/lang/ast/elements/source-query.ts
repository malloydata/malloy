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
import {
  DefineQuery,
  DefineSource,
  ExistingQuery,
  FieldName,
  FullQuery,
  NamedSource,
  QOPDesc,
  QueryElement,
  QuerySource,
  RefinedSource,
  SourceDesc,
} from '..';
import {
  DocStatement,
  Document,
  MalloyElement,
  ModelEntryReference,
  // DocStatementList,
} from '../types/malloy-element';
import {Noteable, extendNoteMethod} from '../types/noteable';
import {Source} from './source';

export class DefineStatement
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'defineStatement';
  constructor(
    readonly name: string,
    readonly defType: 'source' | 'query',
    readonly valueTree: SourceQueryNode
  ) {
    super();
    if (valueTree) {
      this.has({valueTree});
    }
  }

  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): void {
    if (this.defType === 'source') {
      const src = this.valueTree.getSource();
      if (src) {
        const srcDef = new DefineSource(this.name, src, true);
        this.has({srcDef});
        srcDef.execute(doc);
      } else {
        this.valueTree.sqLog('Cannot make a source out of this expression');
      }
    } else if (this.defType === 'query') {
      const query = this.valueTree.getQuery();
      if (query) {
        const queryDef = new DefineQuery(this.name, query);
        this.has({queryDef});
        queryDef.execute(doc);
      } else {
        this.valueTree.sqLog('Canot make a query out of this expression');
      }
    }
  }
}

export abstract class SourceQueryNode extends MalloyElement {
  elementType = 'sourceQueryNode';
  errored = false;

  getSource(): Source | undefined {
    return;
  }

  getQuery(): QueryElement | undefined {
    return;
  }

  isSource(): boolean {
    return false;
  }

  sqLog(message: string) {
    if (this.isErrorFree()) {
      this.log(message);
    }
    this.errored = true;
  }

  isErrorFree(): boolean {
    if (this.errored) {
      return false;
    }
    let clean = true;
    for (const child of this.walk()) {
      if (child instanceof SourceQueryNode && child.errored) {
        clean = false;
        break;
      }
    }
    return clean;
  }
}

export class SQReference extends SourceQueryNode {
  elementType = 'sqReference';
  ref: ModelEntryReference;
  asSource?: Source;

  constructor(name: string) {
    super();
    this.ref = new ModelEntryReference(name);
    this.has({ref: this.ref});
  }

  getQuery(): QueryElement | undefined {
    if (this.ref.getNamed()?.type === 'query') {
      const query = new ExistingQuery();
      query.head = this.ref.name;
      this.has({query});
      return query;
    }
  }

  isSource() {
    return this.ref.getNamed()?.type === 'struct';
  }

  getSource(): Source | undefined {
    if (this.asSource) {
      return this.asSource;
    }
    const entry = this.ref.getNamed();
    if (!entry) {
      this.sqLog(`Undefined query or source '${this.ref.name}`);
      return;
    }
    if (entry.type === 'query') {
      const existingQuery = new ExistingQuery();
      existingQuery.head = this.ref.name;
      this.asSource = new QuerySource(existingQuery);
    } else if (entry.type === 'struct') {
      this.asSource = new NamedSource(this.ref);
    } else {
      this.sqLog(
        `Expected '${this.ref.refString}' to be of type query or source, not '${entry.type}'`
      );
    }
    this.has({source: this.asSource});
    return this.asSource;
  }
}

export class SQExtendedSource extends SourceQueryNode {
  elementType = 'sqExtendedSource';
  asSource?: RefinedSource;

  constructor(
    readonly sqSrc: SourceQueryNode,
    readonly extend: SourceDesc
  ) {
    super({sqSrc, extend});
  }

  getSource() {
    if (this.asSource) {
      return this.asSource;
    }
    const src = this.sqSrc.getSource();
    if (src) {
      this.asSource = new RefinedSource(src, this.extend);
      this.has({asSource: this.asSource});
      return this.asSource;
    }
    this.sqLog('Could not compute source to extend');
  }

  isSource() {
    return true;
  }
}

export class SQApplyView extends SourceQueryNode {
  elementType = 'sqApplyView';
  constructor(
    readonly applyTo: SourceQueryNode,
    readonly viewList: (string | QOPDesc)[]
  ) {
    super({applyTo: applyTo});
  }

  getQuery() {
    let theQuery: QueryElement;
    const views = [...this.viewList];
    if (this.applyTo.isSource()) {
      const querySrc = this.applyTo.getSource();
      if (!querySrc) {
        this.sqLog('Could not get source for query');
        return;
      }
      this.has({querySrc});
      theQuery = new FullQuery(querySrc);
      this.has({theQuery});
      let head = views.shift();
      if (typeof head === 'string') {
        theQuery.turtleName = new FieldName(head);
      }
      if (views.length === 1) {
        head = views[0];
        if (head instanceof QOPDesc) {
          theQuery.addSegments(head);
          views.shift();
        }
      }
      if (views.length > 0) {
        this.sqLog('query definition by combining not yet supported');
        return;
      }
      return theQuery;
    }

    const found = this.applyTo.getQuery();
    if (!found) {
      this.sqLog('Could not create query to extend');
      return;
    }
    theQuery = found;
    this.has({theQuery});
    const head = views[0];
    if (views.length === 1) {
      if (head instanceof QOPDesc) {
        theQuery.addSegments(head);
        views.shift();
      } else {
        this.sqLog(`Cannot reference view '${head}' in output of query`);
        return;
      }
    } else {
      this.sqLog('query definition by combining not yet supported');
      return;
    }
    return theQuery;
  }

  getSource(): Source | undefined {
    const query = this.getQuery();
    if (!query) {
      this.sqLog("Couldn't comprehend query well enough to make a source");
      return;
    }
    const asSource = new QuerySource(query);
    this.has({asSource});
    return asSource;
  }
}

export class SQRefinedQuery extends SourceQueryNode {
  elementType = 'sqRefinedQuery';

  constructor(
    readonly toRefine: SourceQueryNode,
    readonly refine: QOPDesc
  ) {
    super({toRefine, refine});
  }

  getQuery() {
    if (this.toRefine.isSource()) {
      this.sqLog('Cannot add view refinements to a source');
      return;
    }
    const query = this.toRefine.getQuery();
    if (query) {
      // todo error if query is already refined
      query.refineWith(this.refine);
      this.has({query});
      return query;
    }
  }

  getSource() {
    const query = this.getQuery();
    if (query) {
      const queryAsSource = new QuerySource(query);
      this.has({queryAsSource});
      return queryAsSource;
    }
  }
}
