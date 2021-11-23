/*
 * Copyright 2021 Google LLC
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
} from "@malloy-lang/malloy";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";

function mapSymbol(symbol: MalloyDocumentSymbol): DocumentSymbol {
  const type = symbol.getType();
  return {
    name: symbol.getName(),
    range: symbol.getRange().toJSON(),
    detail: symbol.getType(),
    kind:
      type === "explore"
        ? SymbolKind.Namespace
        : type === "turtle"
        ? SymbolKind.Class
        : type === "join"
        ? SymbolKind.Interface
        : SymbolKind.Field,
    selectionRange: symbol.getRange().toJSON(),
    children: symbol.getChildren().map(mapSymbol),
  };
}

export function getMalloySymbols(document: TextDocument): DocumentSymbol[] {
  return Malloy.parse({ source: document.getText() })
    .getSymbols()
    .map(mapSymbol);
}
