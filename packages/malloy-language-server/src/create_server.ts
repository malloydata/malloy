/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  InitializeParams,
  InitializeResult,
  CompletionItem,
  HoverParams,
  Hover,
  Connection,
  Position,
  DidChangeConfigurationParams,
} from 'vscode-languageserver';
import {TextDocuments, TextDocumentSyncKind} from 'vscode-languageserver';
import debounce from 'lodash/debounce';

import {TextDocument} from 'vscode-languageserver-textdocument';
import type {URLReader} from '@malloydata/malloy';
import {
  getMalloyDiagnostics,
  aggregateNotebookDiagnostics,
} from './diagnostics';
import {getMalloySymbols} from './symbols';
import {getMalloyLenses} from './lenses';
import {
  getCompletionItems,
  resolveCompletionItem,
} from './completions/completions';
import {getHover} from './hover/hover';
import {getMalloyDefinitionReference} from './definitions/definitions';
import type {
  CellDataProvider,
  WorkspaceFolderProvider,
} from './translate_cache';
import {TranslateCache} from './translate_cache';
import type {CommonConnectionManager} from './common/connection_manager';
import {findMalloyLensesAt} from './lenses/lenses';
import {prettyLogUri} from './common/log';
import {getMalloyCodeAction} from './code_actions/code_actions';

export interface CreateServerOptions {
  onDidChangeConfiguration?: (params: DidChangeConfigurationParams) => void;
  urlReader?: URLReader;
  cellDataProvider?: CellDataProvider;
  workspaceFolderProvider?: WorkspaceFolderProvider;
}

export const createServer = (
  connection: Connection,
  connectionManager: CommonConnectionManager,
  options?: CreateServerOptions
) => {
  const urlReader = options?.urlReader ?? connectionManager.getURLReader();
  if (!urlReader) {
    throw new Error(
      'A URLReader must be provided via options.urlReader or connectionManager.setURLReader()'
    );
  }

  const documents = new TextDocuments(TextDocument);
  connection.onInitialize((params: InitializeParams) => {
    connection.console.info('onInitialize');

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
        codeActionProvider: {
          resolveProvider: false,
        },
        definitionProvider: true,
        hoverProvider: true,
      },
    };

    if (params.capabilities.workspace?.workspaceFolders) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true,
        },
      };
    }

    if (params.workspaceFolders) {
      connectionManager.setWorkspaceRoots(
        params.workspaceFolders.map(f => f.uri)
      );
    }

    return result;
  });

  const logger = {
    info: (msg: string) => connection.console.info(msg),
    debug: (msg: string) => connection.console.log(msg),
    error: (msg: string) => connection.console.error(msg),
  };

  const translateCache = new TranslateCache(
    documents,
    logger,
    connectionManager,
    urlReader,
    options?.cellDataProvider,
    options?.workspaceFolderProvider,
    connection
  );

  async function diagnoseDocument(document: TextDocument) {
    const prettyUri = prettyLogUri(document.uri);

    connection.console.info(`diagnoseDocument ${prettyUri} start`);
    const versionsAtRequestTime = new Map(
      documents.all().map(document => [document.uri, document.version])
    );
    const diagnostics = await getMalloyDiagnostics(translateCache, document);

    for (const uri in diagnostics) {
      const versionAtRequest = versionsAtRequestTime.get(uri);
      const currentVersion = documents.get(uri)?.version;
      if (
        versionAtRequest === undefined ||
        currentVersion === versionAtRequest
      ) {
        await connection.sendDiagnostics({
          uri,
          diagnostics: diagnostics[uri],
          version: currentVersion,
        });
      }
    }

    try {
      const notebookDiagnostics = await aggregateNotebookDiagnostics(
        diagnostics,
        translateCache
      );
      for (const notebookUri in notebookDiagnostics) {
        await connection.sendDiagnostics({
          uri: notebookUri,
          diagnostics: notebookDiagnostics[notebookUri],
        });
      }
    } catch (error) {
      connection.console.error(
        `Failed to aggregate notebook diagnostics: ${error}`
      );
    }

    for (const dependency of translateCache.dependentsOf(document.uri) ?? []) {
      const document = documents.get(dependency);
      if (document) {
        connection.console.info(
          `diagnoseDocument recompiling ${prettyLogUri(document.uri)}`
        );
        debouncedDiagnoseDocument(document);
      }
    }
    connection.console.info(`diagnoseDocument ${prettyUri} end`);
  }

  const debouncedDiagnoseDocuments: Record<
    string,
    (document: TextDocument) => Promise<void> | undefined
  > = {};

  const debouncedDiagnoseDocument = (document: TextDocument) => {
    const {uri} = document;
    if (!debouncedDiagnoseDocuments[uri]) {
      debouncedDiagnoseDocuments[uri] = debounce(diagnoseDocument, 300);
    }
    debouncedDiagnoseDocuments[uri](document)?.catch(console.error);
  };

  documents.onDidChangeContent(change => {
    debouncedDiagnoseDocument(change.document);
  });

  function ejectIfUnused(uri: string) {
    const dependents = translateCache.dependentsOf(uri);
    if (dependents && dependents.length === 0) {
      connection.console.info(`ejectIfUnused ejecting ${prettyLogUri(uri)}`);
      const dependencies = translateCache.dependenciesFor(uri) ?? [];
      translateCache.deleteModel(uri);
      for (const other of dependencies) {
        const document = documents.get(other);
        if (document === undefined) {
          connection.console.info(
            `ejectIfUnused no document for ${prettyLogUri(
              other
            )}, considering deletion`
          );
          ejectIfUnused(other);
        }
      }
    }
  }

  documents.onDidClose(event => {
    const {uri} = event.document;
    ejectIfUnused(uri);
    delete debouncedDiagnoseDocuments[uri];
  });

  connection.onDocumentSymbol(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (document && document.languageId === 'malloy') {
      try {
        return getMalloySymbols(document);
      } catch (error) {
        console.error('getMalloySymbols', error);
      }
    }
    return [];
  });

  connection.onCodeLens(async handler => {
    const document = documents.get(handler.textDocument.uri);
    if (document && document.languageId === 'malloy') {
      try {
        return await getMalloyLenses(connection, document, connectionManager);
      } catch (error) {
        console.error('getMalloyLenses', error);
      }
    }
    return [];
  });

  connection.onCodeAction(async handler => {
    const document = documents.get(handler.textDocument.uri);
    if (document) {
      return getMalloyCodeAction(translateCache, document, handler.range);
    }
    return null;
  });

  connection.onRequest(
    'malloy/findLensesAt',
    async ({uri, position}: {uri: string; position: Position}) => {
      const document = documents.get(uri);
      if (document && position) {
        try {
          return await findMalloyLensesAt(
            connection,
            document,
            position,
            connectionManager
          );
        } catch (error) {
          console.error('findMalloyLensesAt', error);
        }
      }
      return [];
    }
  );

  connection.onDefinition(handler => {
    const document = documents.get(handler.textDocument.uri);
    if (document && document.languageId === 'malloy') {
      try {
        return getMalloyDefinitionReference(
          translateCache,
          document,
          handler.position
        );
      } catch (error) {
        console.error('getMalloyDefinitionReference', error);
      }
    }
    return [];
  });

  connection.onDidChangeConfiguration(change => {
    options?.onDidChangeConfiguration?.(change);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settings = (change?.settings as any)?.malloy ?? {};
    connectionManager.setConnectionsConfig(settings.connectionMap ?? {});
    connectionManager.setGlobalConfigDirectory(
      settings.globalConfigDirectory ?? ''
    );
    translateCache.deleteAllModels();
    documents.all().forEach(debouncedDiagnoseDocument);
  });

  connection.onRequest(
    'malloy/getEffectiveConfigSource',
    async ({fileUri}: {fileUri: string}) => {
      return connectionManager.getEffectiveConfigSource(new URL(fileUri));
    }
  );

  connection.onRequest('malloy/invalidateConnectionCache', () => {
    connectionManager.notifyConfigFileChanged();
    translateCache.deleteAllModels();
    documents.all().forEach(debouncedDiagnoseDocument);
  });

  connection.onCompletion(async (params): Promise<CompletionItem[]> => {
    const document = documents.get(params.textDocument.uri);
    if (document && document.languageId === 'malloy') {
      try {
        const completionItems = await getCompletionItems(
          document,
          params,
          translateCache
        );
        return completionItems;
      } catch (error) {
        console.error('getCompletionItems', error);
      }
    }
    return [];
  });

  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return resolveCompletionItem(item);
  });

  connection.onHover(async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);

    if (document && document.languageId === 'malloy') {
      try {
        return getHover(document, documents, translateCache, params);
      } catch (error) {
        console.error('getHover', error);
      }
    }
    return null;
  });

  documents.listen(connection);

  connection.listen();

  connection.console.info('Server loaded');
};
