/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  isPersistableSourceDef,
  type SQLPhraseSegment,
} from '../../../model/malloy_types';

import {MalloyElement} from '../types/malloy-element';
import {SourceQueryElement} from '../source-query-elements/source-query-element';

type SQLStringSegment = string | SourceQueryElement;
export class SQLString extends MalloyElement {
  elementType = 'sqlString';
  elements: SQLStringSegment[] = [];
  containsQueries = false;

  complete() {
    this.has({
      queries: this.elements.filter(isQuery),
    });
  }

  push(el: string | MalloyElement): void {
    if (typeof el === 'string') {
      if (el.length > 0) {
        this.elements.push(el);
      }
    } else if (el instanceof SourceQueryElement) {
      this.elements.push(el);
      this.containsQueries = true;
      el.parent = this;
    } else {
      el.logError(
        'invalid-sql-source-interpolation',
        'This element is not legal inside an SQL string'
      );
    }
  }

  sqlPhrases(): [boolean, SQLPhraseSegment[]] {
    const ret: SQLPhraseSegment[] = [];
    let valid = true;
    for (const el of this.elements) {
      if (typeof el === 'string') {
        ret.push({sql: el});
      } else if (el.isSource()) {
        // Check if it's a persistable source first
        const source = el.getSource();
        if (source) {
          const sourceDef = source.getSourceDef(undefined);
          if (isPersistableSourceDef(sourceDef)) {
            ret.push(sourceDef);
            continue;
          }
        }
        el.sqLog('failed-to-expand-sql-source', 'Cannot expand into a query');
        valid = false;
      } else {
        // Not a source - try as a query
        const queryObject = el.getQuery();
        if (queryObject) {
          ret.push(queryObject.query(false));
        } else {
          el.sqLog('failed-to-expand-sql-source', 'Cannot expand into a query');
          valid = false;
        }
      }
    }
    return [valid, ret];
  }
}

function isQuery(x: SQLStringSegment): x is SourceQueryElement {
  return x instanceof SourceQueryElement;
}
