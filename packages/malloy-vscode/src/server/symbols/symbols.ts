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
  MalloyTranslator,
} from "malloy";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver/node";

function mapSymbol(symbol: MalloyDocumentSymbol): DocumentSymbol {
  return {
    name: symbol.name,
    range: symbol.range,
    detail: symbol.type,
    kind:
      symbol.type === "explore"
        ? SymbolKind.Namespace
        : symbol.type === "turtle"
        ? SymbolKind.Class
        : symbol.type === "join"
        ? SymbolKind.Interface
        : SymbolKind.Field,
    selectionRange: symbol.range,
    children: symbol.children.map(mapSymbol),
  };
}

export function getMalloySymbols(document: TextDocument): DocumentSymbol[] {
  const uri = document.uri.toString();
  const translator = new MalloyTranslator(uri, {
    URLs: {
      [uri]: document.getText(),
    },
  });

  const metadata = translator.metadata();
  return metadata.symbols?.map(mapSymbol) || [];
}
