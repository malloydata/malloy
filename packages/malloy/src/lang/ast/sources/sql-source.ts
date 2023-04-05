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
  StructDef,
  StructRef,
  isSQLBlockStruct,
} from '../../../model/malloy_types';
import {NamedSource} from './named-source';

export class SQLSource extends NamedSource {
  elementType = 'sqlSource';
  structRef(): StructRef {
    return this.structDef();
  }

  modelStruct(): StructDef | undefined {
    const modelEnt = this.modelEntry(this.ref);
    const entry = modelEnt?.entry;
    if (!entry) {
      this.log(`Undefined from_sql source '${this.refName}'`);
      return;
    }
    if (entry.type === 'query') {
      this.log(`Cannot use 'from_sql()' to explore query '${this.refName}'`);
      return;
    } else if (isSQLBlockStruct(entry) && entry.declaredSQLBlock) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {declaredSQLBlock, ...newEntry} = entry;
      return newEntry;
    }
    this.log(`Cannot use 'from_sql()' to explore '${this.refName}'`);
  }
}
