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
import {QuerySource} from '../sources/query-source';
import {NamedSource} from '../sources/named-source';
import {SourceDesc} from '../types/source-desc';
import {QOPDesc} from '../query-properties/qop-desc';
import {
  ViewFieldReference,
  ViewOrScalarFieldReference,
} from '../query-items/field-references';
import {QueryProperty, isQueryProperty} from '../types/query-property';
import {SourceProperty, isSourceProperty} from '../types/source-property';
import {LogSeverity} from '../../parse-log';
import {Arrow} from '../query-elements/arrow';
import {Refine} from '../query-elements/refine';
import {QueryReference} from '../query-elements/query-reference';

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
        const query = new QueryReference(this.ref);
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
      const existingQuery = new QueryReference(this.ref);
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
    readonly hasPlus: boolean,
    readonly m4Severity: LogSeverity | false
  ) {
    super({sourceQuery, plus});
  }

  getQuery() {
    const asQuery = this.sourceQuery.getQuery();
    if (!asQuery) {
      return;
    }
    if (!this.hasPlus && this.m4Severity) {
      this.log(
        'Implicit query refinement is deprecated, use the `+` operator',
        this.m4Severity
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
    const refinedQuery = new Refine(asQuery, new QOPDesc(stmts));
    this.has({refinedQuery});
    return refinedQuery;
  }

  getSource() {
    let asSource = this.sourceQuery.getSource();
    if (!asSource) {
      return;
    }
    if (this.m4Severity) {
      if (this.hasPlus) {
        this.log(
          'Source extension with "+" is deprecated, use the "extend" operator',
          this.m4Severity
        );
      } else {
        this.log(
          'Implicit source extension is deprecated, use the `extend` operator.',
          this.m4Severity
        );
      }
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

export type ArrowViewComponent = ViewOrScalarFieldReference | QOPDesc;

export class SQAppendView extends SourceQueryNode {
  elementType = 'sqAppendView';
  constructor(
    readonly applyTo: SourceQueryNode,
    readonly operation: ViewOrScalarFieldReference | QOPDesc
  ) {
    super({applyTo, operation});
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
    const lhs = this.applyTo.isSource()
      ? this.applyTo.getSource()
      : this.applyTo.getQuery();
    if (lhs === undefined) {
      this.sqLog('Could not get LHS of arrow operation');
      return;
    }
    const arr = new Arrow(lhs, this.operation);
    this.has({query: arr});
    return arr;
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
    readonly refine: QOPDesc | ViewOrScalarFieldReference
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
      const resultQuery = new Refine(refinedQuery, this.refine);
      this.has({query: resultQuery});
      return resultQuery;
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
    // TODO previously this returned an "empty" full query... I'm not sure when this is necessary
    this.sqLog(
      'This source should be explicity wrapped in an Arrow, not auto-wrapped'
    );
    return undefined;
  }
}
