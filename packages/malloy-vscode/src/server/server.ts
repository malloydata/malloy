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

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  SemanticTokensBuilder,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getMalloyDiagnostics } from "./diagnostics";
import { getMalloySymbols } from "./symbols";
import {
  TOKEN_TYPES,
  TOKEN_MODIFIERS,
  getMalloyHighlights,
} from "./highlights";
import { getMalloyLenses } from "./lenses";

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentSymbolProvider: true,
      codeLensProvider: {
        resolveProvider: false,
      },
      semanticTokensProvider: {
        full: true,
        range: false,
        legend: {
          tokenTypes: TOKEN_TYPES,
          tokenModifiers: TOKEN_MODIFIERS,
        },
      },
    },
  };

  if (capabilities.workspace?.workspaceFolders) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
});

documents.onDidChangeContent(async (change) => {
  const diagnostics = await getMalloyDiagnostics(documents, change.document);
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

connection.onDocumentSymbol((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document ? getMalloySymbols(document) : [];
});

connection.languages.semanticTokens.on((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document
    ? getMalloyHighlights(document)
    : new SemanticTokensBuilder().build();
});

connection.onCodeLens((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document ? getMalloyLenses(document) : [];
});

documents.listen(connection);

connection.listen();
