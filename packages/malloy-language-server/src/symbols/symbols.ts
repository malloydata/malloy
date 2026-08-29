/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TextDocument} from 'vscode-languageserver-textdocument';
import type {DocumentSymbol as MalloyDocumentSymbol} from '@malloydata/malloy';
import type {DocumentSymbol} from 'vscode-languageserver';
import {SymbolKind} from 'vscode-languageserver';
import {parseWithCache} from '../parse_cache';

function mapSymbol({
  name,
  range,
  type,
  children,
}: MalloyDocumentSymbol): DocumentSymbol {
  let kind: SymbolKind;
  let detail = type;
  switch (type) {
    case 'explore':
      kind = SymbolKind.Namespace;
      detail = 'source';
      break;
    case 'query':
      kind = SymbolKind.Class;
      break;
    case 'join':
      kind = SymbolKind.Interface;
      break;
    case 'unnamed_query':
      kind = SymbolKind.Class;
      break;
    default:
      kind = SymbolKind.Field;
  }
  return {
    name: name || 'unnamed',
    range: range.toJSON(),
    detail,
    kind,
    selectionRange: range.toJSON(),
    children: children.map(mapSymbol),
  };
}

export function getMalloySymbols(document: TextDocument): DocumentSymbol[] {
  return parseWithCache(document).symbols.map(mapSymbol);
}
