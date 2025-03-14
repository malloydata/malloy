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

import type {ModelEntryReference} from '../types/malloy-element';
import type {Source} from '../source-elements/source';
import {SourceQueryElement} from './source-query-element';
import type {QueryElement} from '../types/query-element';
import {QuerySource} from '../source-elements/query-source';
import {NamedSource} from '../source-elements/named-source';
import {QueryReference} from '../query-elements/query-reference';
import type {Argument} from '../parameters/argument';
import {isSourceDef} from '../../../model';

/**
 * A reference to either a source or a query.
 *
 * e.g. `flights`
 */
export class SQReference extends SourceQueryElement {
  elementType = 'sq-reference';
  asSource?: Source;

  constructor(
    readonly ref: ModelEntryReference,
    readonly args?: Argument[] | undefined
  ) {
    super({ref});
    if (args !== undefined) {
      this.has({args});
    }
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
          'cannot-use-as-query',
          `Illegal reference to '${entry.as || entry.name}', query expected`
        );
      }
    } else {
      this.ref.logError(
        'source-or-query-not-found',
        `Reference to undefined object '${this.ref.refString}'`
      );
      this.errored = true;
    }
    return;
  }

  isSource() {
    const refTo = this.ref.getNamed();
    return refTo !== undefined && isSourceDef(refTo);
  }

  getSource(): Source | undefined {
    if (this.asSource) {
      return this.asSource;
    }
    const entry = this.ref.getNamed();
    if (!entry) {
      this.ref.logError(
        'source-not-found',
        `Reference to undefined object '${this.ref.refString}'`
      );
      this.errored = true;
      return;
    }
    if (entry.type === 'query') {
      if (this.args !== undefined) {
        this.ref.logError(
          'illegal-query-argument',
          'Arguments cannot be passed to queries'
        );
      }
      const existingQuery = new QueryReference(this.ref);
      this.asSource = new QuerySource(existingQuery);
    } else if (isSourceDef(entry)) {
      this.asSource = new NamedSource(this.ref, undefined, this.args);
    } else {
      this.sqLog(
        'cannot-use-struct-as-source',
        `Expected '${this.ref.refString}' to be of type query or source, not '${entry.type}'`
      );
      return;
    }
    this.has({asSource: this.asSource});
    return this.asSource;
  }
}
