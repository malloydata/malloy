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

import type {ModelDataRequest} from '../../translate-response';
import type {DocStatement, Document} from '../types/malloy-element';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {SourceID} from '../../../model/malloy_types';
import {
  isSourceDef,
  isPersistableSourceDef,
  isSourceRegistryReference,
} from '../../../model/malloy_types';
import {registerSource} from '../../../model/source_def_utils';
import {findPersistentDependencies} from '../../../model/persist_utils';
import type {BuildNode} from '../../../api/foundation/types';

/** Walk BuildNode tree and collect all sourceIDs */
function collectSourceIDs(nodes: BuildNode[], into: Set<SourceID>): void {
  for (const node of nodes) {
    into.add(node.sourceID);
    collectSourceIDs(node.dependsOn, into);
  }
}

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

  constructor(
    readonly url: string,
    baseURL: string
  ) {
    super([]);
    try {
      this.fullURL = decodeURI(new URL(url, baseURL).toString());
    } catch (e) {
      this.logError('invalid-import-url', 'Invalid URL in import statement');
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
      this.logError(
        'no-translator-for-import',
        'Cannot import without translation context'
      );
    } else if (this.fullURL) {
      const pretranslated = trans.root.pretranslatedModels.get(this.fullURL);
      const src = trans.root.importZone.getEntry(this.fullURL);
      if (pretranslated || src.status === 'present') {
        const importedModel = trans.importModelDef(this.fullURL);
        if (importedModel) {
          const importAll = this.empty();
          const explicitImport: Record<string, string> = {};
          for (const importOne of this.list) {
            const dstName = importOne.text;
            const srcName = importOne.from ? importOne.from.text : dstName;
            if (importedModel.contents[srcName] === undefined) {
              importOne.logError(
                'selective-import-not-found',
                `Cannot find '${srcName}', not imported`
              );
            } else if (doc.getEntry(dstName)) {
              importOne.logError(
                'name-conflict-on-selective-import',
                `Cannot redefine '${dstName}'`
              );
            } else {
              explicitImport[srcName] = dstName;
            }
          }
          const neededSourceIDs = new Set<SourceID>();
          for (const srcName of importedModel.exports) {
            const picked = explicitImport[srcName];
            const dstName = picked || srcName;
            if (importAll || picked) {
              const importMe = {...importedModel.contents[srcName]};
              importMe.as = dstName;
              doc.setEntry(dstName, {entry: importMe, exported: false});

              // Collect dependencies for persistable sources
              if (isSourceDef(importMe) && isPersistableSourceDef(importMe)) {
                const deps = findPersistentDependencies(
                  importMe,
                  importedModel
                );
                collectSourceIDs(deps, neededSourceIDs);
              }
            }
          }

          // Register hidden dependencies from child's registry
          for (const sourceID of neededSourceIDs) {
            if (!(sourceID in doc.documentSrcRegistry)) {
              const value = importedModel.sourceRegistry[sourceID];
              if (value) {
                // If entry is a reference, resolve it to actual SourceDef
                // (parent can't resolve by name since it's not in namespace)
                let entry = value.entry;
                if (isSourceRegistryReference(entry)) {
                  const resolved = importedModel.contents[entry.name];
                  if (
                    resolved &&
                    isSourceDef(resolved) &&
                    isPersistableSourceDef(resolved)
                  ) {
                    entry = resolved;
                  }
                }
                registerSource(doc.documentSrcRegistry, sourceID, entry);
              }
            }
          }
        }
      } else if (src.status === 'error') {
        this.logError('failed-import', `import failed: '${src.message}'`);
      } else {
        this.logError(
          'failed-import',
          `import failed with status: '${src.status}'`
        );
      }
    }
  }
}
