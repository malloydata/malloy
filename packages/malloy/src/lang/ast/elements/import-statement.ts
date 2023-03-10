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

import {ModelDataRequest} from '../../translate-response';
import {DocStatement, Document, MalloyElement} from '../types/malloy-element';

export class ImportStatement extends MalloyElement implements DocStatement {
  elementType = 'import statement';
  fullURL?: string;

  /*
   * At the time of writng this comment, it is guaranteed that if an AST
   * node for an import statement is created, the translator has already
   * succesfully fetched the URL referred to in the statement.
   *
   * Error checking code in here is future proofing against a day when
   * there are other ways to contruct an AST.
   */

  constructor(readonly url: string, baseURL: string) {
    super();
    try {
      this.fullURL = decodeURI(new URL(url, baseURL).toString());
    } catch (e) {
      this.log('Invalid URI in import statement');
    }
  }

  execute(doc: Document): ModelDataRequest {
    const trans = this.translator();
    if (!trans) {
      this.log('Cannot import without translation context');
    } else if (this.fullURL) {
      const src = trans.root.importZone.getEntry(this.fullURL);
      if (src.status === 'present') {
        const childNeeds = trans.childRequest(this.fullURL);
        if (childNeeds) {
          return childNeeds;
        }
        const importStructs = trans.getChildExports(this.fullURL);
        console.log("IMPORT STRUCTS = ", importStructs);
        for (const importing in importStructs) {
          doc.setEntry(importing, {
            entry: importStructs[importing],
            exported: false,
          });
        }
      } else if (src.status === 'error') {
        this.log(`import failed: '${src.message}'`);
      } else {
        this.log(`import failed with status: '${src.status}'`);
      }
    }
    return undefined;
  }
}
