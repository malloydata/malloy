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

import {SQLPhrase} from '../../../model/malloy_types';

import {MalloyElement} from '../types/malloy-element';
import {SourceQueryNode} from '../elements/source-query';

type SQLStringSegment = string | SourceQueryNode;
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
    } else if (el instanceof SourceQueryNode) {
      this.elements.push(el);
      this.containsQueries = true;
      el.parent = this;
    } else {
      el.log('This element is not legal inside an SQL string');
    }
  }

  sqlPhrases(): SQLPhrase[] {
    const ret: SQLPhrase[] = [];
    for (const el of this.elements) {
      if (typeof el === 'string') {
        ret.push({sql: el});
      } else {
        const queryObject = el.getQuery();
        if (queryObject) {
          ret.push(queryObject.query());
        } else {
          el.sqLog('Cannot expand into a query');
        }
      }
    }
    return ret;
  }
}

function isQuery(x: SQLStringSegment): x is SourceQueryNode {
  return x instanceof SourceQueryNode;
}
