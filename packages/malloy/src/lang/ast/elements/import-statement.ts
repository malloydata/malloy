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
import {
  DocStatement,
  Document,
  ListOf,
  MalloyElement,
} from '../types/malloy-element';

export class ImportSourceName extends MalloyElement {
  elementType = 'importSourceName';
  constructor(readonly text: string) {
    super();
  }
}

export class ImportSelect extends MalloyElement {
  elementType = 'importName';
  constructor(
    readonly text: string,
    readonly from: ImportSourceName | undefined
  ) {
    super();
    if (from) {
      this.has({from});
    }
  }
}

export class ImportStatement
  extends ListOf<ImportSelect>
  implements DocStatement
{
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
    super([]);
    try {
      this.fullURL = decodeURI(new URL(url, baseURL).toString());
    } catch (e) {
      this.log('Invalid URI in import statement');
    }
  }

  needs(): ModelDataRequest {
    const trans = this.translator();
    if (trans && this.fullURL) {
      const src = trans.root.importZone.getEntry(this.fullURL);
      if (src.status === 'present') {
        const childNeeds = trans.childRequest(this.fullURL);
        if (childNeeds) return childNeeds;
      }
    }
    return undefined;
  }

  execute(doc: Document): void {
    const trans = this.translator();
    if (!trans) {
      this.log('Cannot import without translation context');
    } else if (this.fullURL) {
      const src = trans.root.importZone.getEntry(this.fullURL);
      if (src.status === 'present') {
        const importable = trans.getChildExports(this.fullURL);
        if (this.notEmpty()) {
          // just import the named objects
          for (const importOne of this.list) {
            const fetchName = importOne.from || importOne;
            if (doc.getEntry(importOne.text)) {
              importOne.log(`Cannot redefine '${importOne.text}'`);
            } else if (importable[fetchName.text]) {
              const importMe = {...importable[fetchName.text]};
              if (importOne.from) {
                importMe.as = importOne.text;
              }
              doc.setEntry(importOne.text, {entry: importMe, exported: false});
            } else {
              fetchName.log(`Cannot find '${fetchName.text}', not imported`);
            }
          }
        } else {
          // import everything
          for (const [importing, entry] of Object.entries(
            trans.getChildExports(this.fullURL)
          )) {
            if (doc.getEntry(importing)) {
              this.log(`Cannot redefine '${importing}'`);
            } else {
              doc.setEntry(importing, {entry, exported: false});
            }
          }
        }
      } else if (src.status === 'error') {
        this.log(`import failed: '${src.message}'`);
      } else {
        this.log(`import failed with status: '${src.status}'`);
      }
    }
  }
}
