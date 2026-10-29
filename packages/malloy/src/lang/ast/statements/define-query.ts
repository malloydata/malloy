/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef, NamedQueryDef} from '../../../model/malloy_types';

import type {DocStatement, Document} from '../types/malloy-element';
import {MalloyElement, DocStatementList} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
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
  ownAnnotation?: AnnotationsDef;

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
    if (this.ownAnnotation) {
      entry.annotations = entry.annotations
        ? {...this.ownAnnotation, inherits: entry.annotations}
        : {...this.ownAnnotation};
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
