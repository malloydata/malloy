/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection, TextDocuments} from 'vscode-languageserver';
import type {
  Model,
  ModelMaterializer,
  URLReader,
  CachedModel,
} from '@malloydata/malloy';
import {CacheManager, MalloyError, Runtime} from '@malloydata/malloy';
import type {TextDocument} from 'vscode-languageserver-textdocument';

import type {ConnectionManager} from './common/types/connection_manager_types';
import type {BuildModelRequest, CellData} from './common/types/file_handler';
import {MalloySQLSQLParser} from '@malloydata/malloy-sql';
import {fixLogRange} from './common/malloy_sql';
import {prettyTime, prettyLogUri, prettyLogInvalidationKey} from './common/log';

/**
 * Logger interface so TranslateCache doesn't depend on a Connection for logging.
 */
export interface TranslateCacheLogger {
  info(message: string): void;
  debug(message: string): void;
  error(message: string): void;
}

/**
 * Optional interface for fetching notebook cell data.
 * Only needed in VS Code — standalone mode throws if notebook cells are encountered.
 */
export interface CellDataProvider {
  fetchCellData(uri: string): Promise<CellData>;
}

/**
 * Optional interface for resolving workspace folders.
 * Only needed for untitled: document URI handling in VS Code.
 */
export interface WorkspaceFolderProvider {
  getWorkspaceFolders(): Promise<{uri: string}[] | null>;
}

/**
 * Inbound request handler type — called when a client sends malloy/fetchModel.
 */
export interface FetchModelResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  explores: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queries: any[];
}

export class TranslateCache {
  private readonly truncatedCache = new Map<
    string,
    {model: Model; exploreCount: number}
  >();

  private readonly cache = new Map<string, CachedModel>();

  private cacheManager = new CacheManager(this);

  public deleteModel(uri: string) {
    this.cache.delete(uri);
    this.truncatedCache.delete(uri);
  }

  public deleteAllModels() {
    this.cache.clear();
    this.truncatedCache.clear();
  }

  public async getModel(url: URL): Promise<CachedModel | undefined> {
    const _url = url.toString();
    const result = this.cache.get(_url);
    const prettyUri = prettyLogUri(_url);
    this.logger.info(
      `translateWithCache ${prettyUri} ${result ? 'hit' : 'miss'}`
    );
    return Promise.resolve(result);
  }

  public async setModel(url: URL, cachedModel: CachedModel): Promise<boolean> {
    const _url = url.toString();
    const prettyUri = prettyLogUri(_url);
    this.logger.info(
      `translateWithCache ${prettyUri} ${prettyLogInvalidationKey(
        cachedModel.invalidationKeys[_url]
      )} set`
    );
    this.cache.set(_url, cachedModel);
    return Promise.resolve(true);
  }

  public dependenciesFor(uri: string): string[] | undefined {
    const entry = this.cache.get(uri);
    if (entry === undefined) return undefined;
    return Object.keys(entry.invalidationKeys ?? {}).filter(
      other => other !== uri
    );
  }

  public dependentsOf(uri: string): string[] | undefined {
    if (!this.cache.has(uri)) return undefined;
    const dependencies: string[] = [];
    const [base, hash] = uri.split('#');
    for (const [otherURI, model] of this.cache.entries()) {
      if (otherURI === uri) continue;
      if (Object.keys(model.invalidationKeys).includes(uri)) {
        dependencies.push(otherURI);
      }
      if (otherURI.startsWith(base)) {
        const [_, keyHash] = otherURI.split('#');
        if (keyHash > hash) {
          dependencies.push(otherURI);
        }
      }
    }
    return dependencies;
  }

  constructor(
    private documents: TextDocuments<TextDocument>,
    private logger: TranslateCacheLogger,
    private connectionManager: ConnectionManager,
    private urlReader: URLReader,
    private cellDataProvider?: CellDataProvider,
    private workspaceFolderProvider?: WorkspaceFolderProvider,
    connection?: Connection
  ) {
    // Register the inbound malloy/fetchModel handler if a Connection is provided
    if (connection) {
      connection.onRequest(
        'malloy/fetchModel',
        async (event: BuildModelRequest): Promise<FetchModelResult> => {
          const model = await this.translateWithCache(
            event.uri,
            event.languageId,
            event.refreshSchemaCache
          );
          if (model) {
            return {
              explores: model.explores.map(explore => explore.toJSON()) || [],
              queries: model.namedQueries,
            };
          } else {
            return {
              explores: [],
              queries: [],
            };
          }
        }
      );
    }
  }

  async getDocumentText(
    documents: TextDocuments<TextDocument>,
    uri: URL
  ): Promise<string> {
    const cached = documents.get(uri.toString());
    if (cached) {
      return cached.getText();
    } else {
      this.logger.info('fetchFile requesting ' + uri.toString());
      const result = await this.urlReader.readURL(uri);
      return typeof result === 'string' ? result : result.contents;
    }
  }

  async createModelMaterializer(
    uri: string,
    runtime: Runtime,
    refreshSchemaCache?: boolean | number
  ): Promise<ModelMaterializer | null> {
    const prettyUri = prettyLogUri(uri);
    this.logger.debug(`createModelMaterializer ${prettyUri} start`);
    let modelMaterializer: ModelMaterializer | null = null;
    const queryFileURL = new URL(uri);
    if (queryFileURL.protocol === 'vscode-notebook-cell:') {
      if (!this.cellDataProvider) {
        throw new Error(
          'Notebook cells (vscode-notebook-cell: URIs) are not supported in standalone mode'
        );
      }
      if (refreshSchemaCache && typeof refreshSchemaCache !== 'number') {
        refreshSchemaCache = Date.now();
      }
      const cellData = await this.getCellData(new URL(uri));
      const importBaseURL = new URL(cellData.baseUri);
      for (const cell of cellData.cells) {
        if (cell.languageId === 'malloy') {
          const url = new URL(cell.uri);
          if (modelMaterializer) {
            modelMaterializer = modelMaterializer.extendModel(url, {
              importBaseURL,
              refreshSchemaCache,
              noThrowOnError: true,
            });
          } else {
            modelMaterializer = runtime.loadModel(url, {
              importBaseURL,
              refreshSchemaCache,
              noThrowOnError: true,
            });
          }
        }
      }
    } else {
      let importBaseURL: URL | undefined;
      if (
        queryFileURL.protocol === 'untitled:' &&
        this.workspaceFolderProvider
      ) {
        const workspaceFolders =
          await this.workspaceFolderProvider.getWorkspaceFolders();
        if (workspaceFolders?.[0]) {
          importBaseURL = new URL(workspaceFolders[0].uri + '/');
        }
      }
      modelMaterializer = runtime.loadModel(queryFileURL, {
        importBaseURL,
        refreshSchemaCache,
        noThrowOnError: true,
      });
    }
    this.logger.debug(`createModelMaterializer ${prettyUri} end`);
    return modelMaterializer;
  }

  async getCellData(uri: URL): Promise<CellData> {
    if (!this.cellDataProvider) {
      throw new Error(
        'Notebook cells (vscode-notebook-cell: URIs) are not supported in standalone mode'
      );
    }
    return await this.cellDataProvider.fetchCellData(uri.toString());
  }

  private async makeRuntime(
    fileURL: URL,
    urlReader: {readURL: (url: URL) => Promise<string>}
  ): Promise<Runtime> {
    const config = await this.connectionManager.getConfigForFile(fileURL);
    return new Runtime({
      urlReader,
      config,
      cacheManager: this.cacheManager,
    });
  }

  async translateWithTruncatedCache(
    document: TextDocument,
    text: string,
    exploreCount: number
  ): Promise<Model | undefined> {
    const prettyUri = prettyLogUri(document.uri);
    this.logger.info(`translateWithTruncatedCache ${prettyUri} start`);
    const {uri, languageId} = document;
    if (languageId === 'malloy') {
      const entry = this.truncatedCache.get(uri);
      if (entry && entry.exploreCount === exploreCount) {
        this.logger.info(`translateWithTruncatedCache ${prettyUri} hit`);
        return entry.model;
      }
      const urlReader = {
        readURL: (url: URL) => {
          if (url.toString() === uri) {
            return Promise.resolve(text);
          } else {
            return this.getDocumentText(this.documents, url);
          }
        },
      };
      const fileURL = new URL(uri);
      const runtime = await this.makeRuntime(fileURL, urlReader);
      const modelMaterializer = await this.createModelMaterializer(
        uri,
        runtime,
        false
      );
      const model = await modelMaterializer?.getModel();
      if (model) {
        this.truncatedCache.set(uri, {
          model,
          exploreCount,
        });
      }
      this.logger.info(`translateWithTruncatedCache ${prettyUri} miss`);
      return model;
    }
    return undefined;
  }

  async translateWithCache(
    uri: string,
    languageId: string,
    refreshSchemaCache?: boolean
  ): Promise<Model | undefined> {
    const prettyUri = prettyLogUri(uri);
    const t0 = performance.now();
    this.logger.info(`translateWithCache ${prettyUri} start`);
    const urlReader = {
      readURL: (url: URL) => this.getDocumentText(this.documents, url),
    };
    const fileURL = new URL(uri);
    const text = await urlReader.readURL(fileURL);
    if (languageId === 'malloy-sql') {
      const parse = MalloySQLSQLParser.parse(text, uri);
      const runtime = await this.makeRuntime(fileURL, urlReader);

      const modelMaterializer = await this.createModelMaterializer(
        uri,
        runtime,
        refreshSchemaCache
      );

      for (const malloyQuery of parse.embeddedMalloyQueries) {
        if (!modelMaterializer) {
          throw new Error('Missing model definition');
        }
        try {
          await modelMaterializer.getQuery(`run:\n${malloyQuery.query}`);
        } catch (e) {
          if (e instanceof MalloyError) {
            e.problems.forEach(log => {
              fixLogRange(uri, malloyQuery, log, -1);
            });
          }

          throw e;
        }
      }

      const model = await modelMaterializer?.getModel();
      this.logger.info(
        `translateWithCache ${prettyUri} end in ${prettyTime(
          performance.now() - t0
        )}s`
      );
      return model;
    } else {
      const runtime = await this.makeRuntime(fileURL, urlReader);

      const modelMaterializer = await this.createModelMaterializer(
        uri,
        runtime,
        refreshSchemaCache
      );
      const model = await modelMaterializer?.getModel();
      this.logger.info(
        `translateWithCache ${prettyUri} end in ${prettyTime(
          performance.now() - t0
        )}`
      );
      return model;
    }
  }
}
