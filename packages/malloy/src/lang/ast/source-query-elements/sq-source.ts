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

import type {Source} from '../source-elements/source';
import {SourceQueryElement} from './source-query-element';
import {QueryRaw} from '../query-elements/query-raw';
import {SQLSource} from '../source-elements/sql-source';

/**
 * An element which wraps a known source (e.g. SQL or table).
 * Can be treated in specific circumstances as a query,
 * e.g. `run: duckdb.sql('...')`, but generally is just used as
 * a source.
 */
export class SQSource extends SourceQueryElement {
  elementType = 'sq-source';

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
      const rawQuery = new QueryRaw(this.theSource);
      this.has({rawQuery});
      return rawQuery;
    } else {
      this.sqLog(
        'invalid-source-as-query',
        'This source cannot be used as a query'
      );
    }
  }
}
