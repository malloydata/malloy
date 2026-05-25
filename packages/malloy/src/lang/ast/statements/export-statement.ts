/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {isSourceDef} from '../../../model/malloy_types';
import type {DocStatement, Document} from '../types/malloy-element';
import {ListOf, MalloyElement} from '../types/malloy-element';

export class ExportItem extends MalloyElement {
  elementType = 'exportItem';
  constructor(readonly name: string) {
    super();
  }
}

export class ExportStatement
  extends ListOf<ExportItem>
  implements DocStatement
{
  elementType = 'export statement';

  constructor(items: ExportItem[]) {
    super(items);
  }

  execute(doc: Document): void {
    if (doc.explicitExports === undefined) {
      doc.explicitExports = new Set<string>();
    }
    const explicit = doc.explicitExports;
    for (const item of this.list) {
      const name = item.name;
      if (explicit.has(name)) {
        item.logError(
          'duplicate-export-name',
          `'${name}' already appears in an export statement`
        );
        continue;
      }
      const entry = doc.documentModel.get(name);
      if (entry === undefined) {
        item.logError(
          'export-name-not-defined',
          `Cannot export '${name}': no such definition above this statement`
        );
        continue;
      }
      const def = entry.entry;
      const exportable =
        isSourceDef(def) ||
        def.type === 'query' ||
        def.type === 'userType' ||
        def.type === 'given';
      if (!exportable) {
        item.logError(
          'export-name-not-exportable',
          `Cannot export '${name}': only sources, queries, given declarations, and user types may be exported`
        );
        continue;
      }
      explicit.add(name);
    }
  }
}
