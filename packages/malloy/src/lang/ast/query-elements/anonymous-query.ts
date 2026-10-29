/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef} from '../../../model';

import type {DocStatement, Document} from '../types/malloy-element';
import {MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
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
  ownAnnotation?: AnnotationsDef;

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
    const annotation = this.ownAnnotation || {};
    if (modelQuery.annotations) {
      annotation.inherits = modelQuery.annotations;
    }
    if (annotation.notes || annotation.blockNotes || annotation.inherits) {
      modelQuery.annotations = {...annotation};
    }
    doc.queryList.push(modelQuery);
  }
}
