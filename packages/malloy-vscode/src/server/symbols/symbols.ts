/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DocumentSymbol as MalloyDocumentSymbol,
  Malloy,
} from "@malloydata/malloy";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";

function mapSymbol(symbol: MalloyDocumentSymbol): DocumentSymbol {
  const type = symbol.type;
  return {
    name: symbol.name,
    range: symbol.range.toJSON(),
    detail: symbol.type,
    kind:
      type === "explore"
        ? SymbolKind.Namespace
        : type === "query"
        ? SymbolKind.Class
        : type === "join"
        ? SymbolKind.Interface
        : SymbolKind.Field,
    selectionRange: symbol.range.toJSON(),
    children: symbol.children.map(mapSymbol),
  };
}

export function getMalloySymbols(document: TextDocument): DocumentSymbol[] {
  return Malloy.parse({ source: document.getText() }).symbols.map(mapSymbol);
}
