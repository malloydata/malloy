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

import {StructDef} from '../../../model';
import {Source} from '../elements/source';
import {ErrorFactory} from '../error-factory';
import {} from '../expressions/constant-sub-expression';
import {ExistingQuery} from '../query-elements/existing-query';
import {ModelEntryReference} from '../types/malloy-element';
import {NamedSource} from './named-source';
import {QuerySource} from './query-source';

export class NamedSourceOrQuery extends Source {
  elementType = 'namedSourceOrQuery';

  constructor(readonly ref: ModelEntryReference) {
    super();
    this.has({ref: ref});
  }

  private getSource(): Source | undefined {
    const modelEnt = this.modelEntry(this.ref);
    const entry = modelEnt?.entry;
    if (!entry) {
      const undefMsg = `Undefined query or source '${this.ref.refString}'`;
      this.ref.log(undefMsg);
      return;
    }
    if (entry.type === 'query') {
      const existingQuery = new ExistingQuery();
      existingQuery.head = this.ref;
      return new QuerySource(existingQuery);
    } else if (entry.type === 'struct') {
      return new NamedSource(this.ref);
    } else {
      this.log(
        `'${this.ref.refString}' is a ${entry.type}, not a query or source`
      );
    }
  }

  structDef(): StructDef {
    const source = this.getSource();
    this.has({source});
    if (source === undefined) {
      return ErrorFactory.structDef;
    }
    return source.structDef();
  }
}
