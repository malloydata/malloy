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
          ret.push(queryObject.query());
        } else {
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
