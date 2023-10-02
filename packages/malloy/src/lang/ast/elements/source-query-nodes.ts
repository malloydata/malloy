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

import {RefinedSource} from './refined-source';
import {MalloyElement, ModelEntryReference} from '../types/malloy-element';
import {Source} from './source';
import {SourceQueryNode} from './source-query';
import {QueryElement} from '../types/query-element';
import {ExistingQuery} from '../query-elements/existing-query';
import {QuerySource} from '../sources/query-source';
import {NamedSource} from '../sources/named-source';
import {SourceDesc} from '../types/source-desc';
import {QOPDesc} from '../query-properties/qop-desc';
import {FullQuery} from '../query-elements/full-query';
import {ViewFieldReference} from '../query-items/field-references';
import {QueryProperty, isQueryProperty} from '../types/query-property';
import {SourceProperty, isSourceProperty} from '../types/source-property';
import {SQLSource} from '../sources/sql-source';

export class SQReference extends SourceQueryNode {
  elementType = 'sqReference';
  asSource?: Source;

  constructor(readonly ref: ModelEntryReference) {
    super({ref});
  }

  getQuery(): QueryElement | undefined {
    const entry = this.ref.getNamed();
    if (entry) {
      if (entry.type === 'query') {
        const query = new ExistingQuery();
        query.head = this.ref.name;
        this.has({query});
        return query;
      } else {
        this.sqLog(
          `Illegal reference to '${entry.as || entry.name}', query expected`
        );
      }
    } else {
      this.ref.log(`Reference to undefined object '${this.ref.refString}'`);
      this.errored = true;
    }
    return;
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
      this.ref.log(`Reference to undefined object '${this.ref.refString}'`);
      this.errored = true;
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
      return;
    }
    this.has({asSource: this.asSource});
    return this.asSource;
  }
}

export class SQLegacyModify extends SourceQueryNode {
  elementType = 'sqLogacyModify';
  constructor(
    readonly sourceQuery: SourceQueryNode,
    readonly plus: MalloyElement[],
    readonly hasPlus: boolean
  ) {
    super({sourceQuery, plus});
  }

  getQuery() {
    const asQuery = this.sourceQuery.getQuery();
    if (!asQuery) {
      return;
    }
    if (!this.hasPlus) {
      this.log(
        'Implicit query refinement is deprecated, use the `+` operator',
        'warn'
      );
    }
    const stmts: QueryProperty[] = [];
    for (const stmt of this.plus) {
      if (isQueryProperty(stmt)) {
        stmts.push(stmt);
      } else {
        // just for typing, should never happen because this is an ambiguous modification
        stmt.log('Unable to add this refinement to query');
      }
    }
    asQuery.refineWith(new QOPDesc(stmts));
    this.has({asQuery});
    return asQuery;
  }

  getSource() {
    let asSource = this.sourceQuery.getSource();
    if (!asSource) {
      return;
    }
    if (this.hasPlus) {
      this.log(
        'Source extension with "+" is deprecated, use the "extend" operator',
        'warn'
      );
    } else {
      this.log(
        'Implicit source extension is deprecated, use the `extend` operator.',
        'warn'
      );
    }
    const stmts: SourceProperty[] = [];
    for (const stmt of this.plus) {
      if (isSourceProperty(stmt)) {
        stmts.push(stmt);
      } else {
        // just for typing, should never happen because this is an ambiguous modification
        stmt.log('Unable to add this extension to source');
      }
    }
    const extend = new SourceDesc(stmts);
    asSource = new RefinedSource(asSource, extend);
    this.has({asSource});
    return asSource;
  }

  isSource() {
    return this.sourceQuery.isSource();
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

export type ArrowViewComponent = ViewFieldReference | QOPDesc;

export class SQAppendView extends SourceQueryNode {
  elementType = 'sqAppendView';
  constructor(
    readonly applyTo: SourceQueryNode,
    readonly viewList: ArrowViewComponent[]
  ) {
    super({applyTo, viewList});
  }

  /*

    if the thing we are applying a view to as a query ... just add a segment
      if the view is a segment

    if it is a source then the first segment is allowed to be a string

    all the rest of the segments are refinements to the first segment

    which are usually illegal ... so patterns

    src -> turtle // ok
    src -> turtle + qop // ok second thing is a refinement
    src -> qop // ok
    query -> qop // ok

    the grammar allows for a list of views and refinements ... these are not translated yet


  */
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
      const head = views[0];
      if (head instanceof ViewFieldReference) {
        theQuery.turtleName = head.list[0];
        if (views.length === 1) {
          return theQuery;
        }
        if (views.length === 2) {
          if (views[1] instanceof QOPDesc) {
            theQuery.refineWith(views[1]);
            return theQuery;
          } else {
            this.sqLog('Cannot refine with a named view');
            return;
          }
        } else {
          this.sqLog('Cannot have multiple refinements');
        }
      } else if (views.length === 1) {
        if (head instanceof QOPDesc) {
          theQuery.addSegments(head);
          return theQuery;
        }
      }
      if (views.length > 0) {
        this.sqLog('Cannot have multiple refinements');
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
      if (this.toRefine instanceof SQReference) {
        this.sqLog(
          `Cannot add view refinements to '${this.toRefine.ref.refString}' because it is a source`
        );
      } else {
        this.sqLog('Cannot add view refinements to a source');
      }
      return;
    }
    const refinedQuery = this.toRefine.getQuery();
    if (refinedQuery) {
      if (refinedQuery.alreadyRefined()) {
        this.sqLog('Cannot refine a refined query');
        return;
      }
      refinedQuery.refineWith(this.refine);
      this.has({query: refinedQuery});
      return refinedQuery;
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

export class SQFrom extends SourceQueryNode {
  elementType = 'sqFrom';

  constructor(readonly from: SourceQueryNode) {
    super({from});
  }

  getSource() {
    return this.from.getSource();
  }

  getQuery() {
    return this.from.getQuery();
  }

  isSource() {
    return true;
  }
}

export class SQSourceWrapper extends SourceQueryNode {
  elementType = 'SQtable';

  constructor(readonly theSource: Source) {
    super({theSource});
  }

  isSource() {
    return true;
  }

  getSource() {
    return this.theSource;
  }

  getQuery() {
    if (this.theSource instanceof SQLSource) {
      const queryObj = new FullQuery(this.theSource);
      this.has({sqlAsQUery: queryObj});
      return queryObj;
    }
    if (this.theSource instanceof NamedSource) {
      this.sqLog(
        `Illegal reference to '${this.theSource.refName}', query expected`
      );
    }
  }
}
