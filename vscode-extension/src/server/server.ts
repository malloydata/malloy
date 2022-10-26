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
  CompletionItem,
  HoverParams,
  Hover,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import { getMalloyDiagnostics } from "./diagnostics";
import { getMalloySymbols } from "./symbols";
import {
  TOKEN_TYPES,
  TOKEN_MODIFIERS,
  stubMalloyHighlights,
} from "./highlights";
import { getMalloyLenses } from "./lenses";
import { CONNECTION_MANAGER } from "./connections";
import {
  getCompletionItems,
  resolveCompletionItem,
} from "./completions/completions";
import { getHover } from "./hover/hover";
import { getMalloyDefinitionReference } from "./definitions/definitions";

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);
let haveConnectionsBeenSet = false;
connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      documentSymbolProvider: true,
      codeLensProvider: {
        resolveProvider: false,
      },
      completionProvider: {
        resolveProvider: true,
      },
      definitionProvider: true,
      semanticTokensProvider: {
        full: true,
        range: false,
        legend: {
          tokenTypes: TOKEN_TYPES,
          tokenModifiers: TOKEN_MODIFIERS,
        },
      },
      hoverProvider: true,
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

async function diagnoseDocument(document: TextDocument) {
  if (haveConnectionsBeenSet) {
    // Necessary to copy the versions, because they're mutated in the same document object
    const versionsAtRequestTime = new Map(
      documents.all().map((document) => [document.uri, document.version])
    );
    const diagnostics = await getMalloyDiagnostics(documents, document);
    // Only send diagnostics if the document hasn't changed since this request started
    for (const uri in diagnostics) {
      const versionAtRequest = versionsAtRequestTime.get(uri);
      if (
        versionAtRequest === undefined ||
        versionAtRequest === document.version
      ) {
        connection.sendDiagnostics({
          uri,
          diagnostics: diagnostics[uri],
          version: documents.get(uri)?.version,
        });
      }
    }
  }
}

documents.onDidChangeContent(async (change) => {
  await diagnoseDocument(change.document);
});

connection.onDocumentSymbol((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document ? getMalloySymbols(document) : [];
});

connection.languages.semanticTokens.on((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document
    ? stubMalloyHighlights(document)
    : new SemanticTokensBuilder().build();
});

connection.onCodeLens((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document ? getMalloyLenses(document) : [];
});

connection.onDefinition((handler) => {
  const document = documents.get(handler.textDocument.uri);
  return document
    ? getMalloyDefinitionReference(documents, document, handler.position)
    : [];
});

connection.onDidChangeConfiguration(async (change) => {
  await CONNECTION_MANAGER.setConnectionsConfig(
    change.settings.malloy.connections
  );
  haveConnectionsBeenSet = true;
  documents.all().forEach(diagnoseDocument);
});

// This handler provides the initial list of the completion items.
connection.onCompletion((params): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri);
  return document ? getCompletionItems(document, params) : [];
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return resolveCompletionItem(item);
});

connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);

  return document ? getHover(document, params) : null;
});

documents.listen(connection);

connection.listen();
