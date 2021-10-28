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

import { Connection } from "./connection";
import { MalloyTranslator, TranslateResponse } from "./lang";
import {
  CompiledQuery,
  ModelDef,
  Query as InternalQuery,
  QueryModel,
  QueryResult,
} from "./model";
import {
  LookupQueryExecutor,
  LookupSchemaReader,
  UriFetcher,
} from "./runtime_types";

export interface Loggable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message?: any, ...optionalParams: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message?: any, ...optionalParams: any[]) => void;
}

export class Malloy {
  // TODO load from file built during release
  public static get version(): string {
    return "0.0.1";
  }

  public static db: Connection;
  private static _log: Loggable;

  public static get log(): Loggable {
    return Malloy._log || console;
  }

  public static setLogger(log: Loggable): void {
    Malloy._log = log;
  }
}

class Model {
  private response: TranslateResponse;

  constructor(response: TranslateResponse) {
    // TODO perhaps call `getSuccessfulTranslation` in constructor so that
    //      an exception is raised immediately.
    this.response = response;
  }

  private getSuccessfulTranslation(reason: string): {
    modelDef: ModelDef;
    queryList: InternalQuery[];
  } {
    if (this.response.translated !== undefined) {
      return this.response.translated;
    } else {
      const error = (this.response.errors || [])[0];

      throw new Error(
        `Cannot ${reason} from failed translation: ${error.message}.`
      );
    }
  }

  public getNamedQuery(queryName: string): Query {
    const translated = this.getSuccessfulTranslation("extract query");
    const struct = translated.modelDef.structs[queryName];
    if (struct.type === "struct") {
      const source = struct.structSource;
      if (source.type === "query") {
        return new Query(source.query, translated.modelDef);
      }
    }

    throw new Error("Given query name does not refer to a named query.");
  }

  public getUnnamedQuery(index = -1): Query {
    const translated = this.getSuccessfulTranslation("extract query");
    const adjustedIndex =
      index === -1 ? translated.queryList.length - 1 : index;
    return new Query(translated.queryList[adjustedIndex], translated.modelDef);
  }

  public getQuery(): Query {
    return this.getUnnamedQuery();
  }

  public get _modelDef(): ModelDef {
    const translated = this.getSuccessfulTranslation("extract model");
    return translated.modelDef;
  }
}

class Query {
  _modelDef: ModelDef;
  _query: InternalQuery;

  constructor(query: InternalQuery, model: ModelDef) {
    this._query = query;
    this._modelDef = model;
  }
}

interface StringModelSpecification {
  string: string;
}

interface UriModelSpecification {
  uri: string;
}

interface CompiledModelSpecification {
  compiled: Model;
}

type UncompiledModelSpecification =
  | StringModelSpecification
  | UriModelSpecification;

export type ModelSpecification =
  | UncompiledModelSpecification
  | CompiledModelSpecification;

interface StringQuerySpecification {
  string: string;
}

interface UriQuerySpecification {
  uri: string;
}

interface CompiledQuerySpecification {
  compiled: Query;
}

type UncompiledQuerySpecification =
  | StringQuerySpecification
  | UriQuerySpecification;

export type QuerySpecification =
  | UncompiledQuerySpecification
  | CompiledQuerySpecification;

function parseTableName(connectionTableString: string) {
  const [firstPart, secondPart] = connectionTableString.split(":");
  if (secondPart) {
    return { connectionName: firstPart, tableName: secondPart };
  } else {
    return { tableName: firstPart };
  }
}

export class Translator {
  private uriFetcher: UriFetcher;
  private lookupSchemaReader: LookupSchemaReader;

  constructor(uriFetcher: UriFetcher, lookupSchemaReader: LookupSchemaReader) {
    this.uriFetcher = uriFetcher;
    this.lookupSchemaReader = lookupSchemaReader;
  }

  private async _compile(
    uri: string,
    malloy: string,
    model?: ModelDef
  ): Promise<Model> {
    const translator = new MalloyTranslator(uri, { URLs: { [uri]: malloy } });
    translator.translate(model);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = translator.translate();
      if (result.final) {
        return new Model(result);
      } else if (result.URLs) {
        for (const neededUri of result.URLs) {
          if (neededUri.startsWith("internal://")) {
            throw new Error(
              "In order to use relative imports, you must compile a file via a URI."
            );
          }
          const neededText = await this.uriFetcher.fetchUriContents(neededUri);
          const URLs = { [neededUri]: neededText };
          translator.update({ URLs });
        }
      } else if (result.tables) {
        // collect tables by connection name since there may be multiple connections
        const tablesByConnection: Map<
          string | undefined,
          Array<string>
        > = new Map();
        for (const connectionTableString of result.tables) {
          const { connectionName, tableName } = parseTableName(
            connectionTableString
          );

          let connectionToTablesMap = tablesByConnection.get(connectionName);
          if (!connectionToTablesMap) {
            connectionToTablesMap = [tableName];
          } else {
            connectionToTablesMap.push(tableName);
          }
          tablesByConnection.set(connectionName, connectionToTablesMap);
        }

        // iterate over connections, fetching schema for all missing tables
        for (const [connectionName, tableNames] of tablesByConnection) {
          const schemaFetcher =
            await this.lookupSchemaReader.lookupSchemaReader(connectionName);
          const tables = await schemaFetcher.fetchSchemaForTables(tableNames);
          translator.update({ tables });
        }
      }
    }
  }

  public async compile(
    primary: ModelSpecification | UncompiledQuerySpecification,
    base?: ModelSpecification
  ): Promise<Model>;
  public async compile(model: ModelSpecification): Promise<Model>;
  public async compile(
    query: UncompiledQuerySpecification,
    model?: ModelSpecification
  ): Promise<Model>;
  public async compile(
    primary: ModelSpecification | UncompiledQuerySpecification,
    base?: ModelSpecification
  ): Promise<Model> {
    let model: Model | undefined;
    if (base !== undefined) {
      if ("compiled" in base) {
        model = base.compiled;
      } else {
        model = await this.compile(base);
      }
    }

    if ("compiled" in primary) {
      return primary.compiled;
    } else if ("string" in primary) {
      return this._compile(
        "internal://query",
        primary.string,
        model?._modelDef
      );
    } else {
      const string = await this.uriFetcher.fetchUriContents(primary.uri);
      return this._compile(primary.uri, string, model?._modelDef);
    }
  }

  public async compileModel(
    model: UncompiledModelSpecification
  ): Promise<Model> {
    return await this.compile(model);
  }

  public async compileQuery(
    query: UncompiledQuerySpecification,
    model?: ModelSpecification
  ): Promise<Query> {
    return (await this.compile(query, model)).getUnnamedQuery();
  }

  public async compileUnnamedQuery(
    model: ModelSpecification,
    index: number
  ): Promise<Query> {
    return (await this.compile(model)).getUnnamedQuery(index);
  }

  public async compileNamedQuery(
    model: ModelSpecification,
    name: string
  ): Promise<Query> {
    return (await this.compile(model)).getNamedQuery(name);
  }

  public async translateQuery(
    query: QuerySpecification,
    model?: ModelSpecification
  ): Promise<SqlQuery> {
    if ("compiled" in query) {
      return this.translate(query.compiled);
    } else {
      return this.translate(
        (await this.compile(query, model)).getUnnamedQuery()
      );
    }
  }

  public async translateUnnamedQuery(
    model: ModelSpecification,
    index: number
  ): Promise<SqlQuery> {
    return this.translate((await this.compile(model)).getUnnamedQuery(index));
  }

  public async translateNamedQuery(
    model: ModelSpecification,
    name: string
  ): Promise<SqlQuery> {
    return this.translate((await this.compile(model)).getNamedQuery(name));
  }

  public async translate(query: Query): Promise<SqlQuery> {
    const queryModel = new QueryModel(query._modelDef);
    // TODO Weird that there's this last stage of computation that happens after the query is already "compiled"
    const compiledQuery = await queryModel.compileQuery(query._query);
    let connectionName;
    {
      const struct =
        typeof query._query.structRef === "string"
          ? query._modelDef.structs[query._query.structRef]
          : query._query.structRef;
      if (struct.structRelationship.type !== "basetable") {
        throw new Error("Expected query to be against a table.");
      } else {
        connectionName = struct.structRelationship.connectionName;
      }
    }
    return new SqlQuery(compiledQuery, connectionName);
  }
}

export class Executor {
  private lookupQueryExecutor: LookupQueryExecutor;

  constructor(lookupQueryExecutor: LookupQueryExecutor) {
    this.lookupQueryExecutor = lookupQueryExecutor;
  }

  public async execute(sqlQuery: SqlQuery): Promise<QueryResult> {
    const sqlQueryRunner = await this.lookupQueryExecutor.lookupQueryExecutor(
      sqlQuery.getConnectionName()
    );
    const result = await sqlQueryRunner.runSqlQuery(
      sqlQuery._getRawQuery().sql
    );
    return {
      ...sqlQuery._getRawQuery(),
      result: result.rows,
      totalRows: result.totalRows,
    };
  }
}

class SqlQuery {
  private connectionName: string;
  private query: CompiledQuery;

  constructor(query: CompiledQuery, connectionName: string) {
    this.query = query;
    this.connectionName = connectionName;
  }

  public getConnectionName() {
    return this.connectionName;
  }

  public _getRawQuery() {
    return this.query;
  }

  getSql() {
    return this.query.sql;
  }
}

export class EmptyUriFetcher implements UriFetcher {
  async fetchUriContents(_uri: string): Promise<string> {
    throw new Error("No files.");
  }
}

export class InMemoryUriFetcher implements UriFetcher {
  private files: Map<string, string>;

  constructor(files: Map<string, string>) {
    this.files = files;
  }

  async fetchUriContents(uri: string): Promise<string> {
    const file = this.files.get(uri);
    if (file !== undefined) {
      return Promise.resolve(file);
    } else {
      throw new Error("File not found.");
    }
  }
}

export class FixedConnections
  implements LookupSchemaReader, LookupQueryExecutor
{
  private connections: Map<string, Connection>;
  private defaultConnectionName?: string;
  constructor(
    connections: Map<string, Connection>,
    defaultConnectionName?: string
  ) {
    this.connections = connections;
    this.defaultConnectionName = defaultConnectionName;
  }

  async getConnection(connectionName?: string): Promise<Connection> {
    if (connectionName === undefined) {
      if (this.defaultConnectionName !== undefined) {
        connectionName = this.defaultConnectionName;
      } else {
        throw new Error("No default connection.");
      }
    }

    const connection = this.connections.get(connectionName);
    if (connection !== undefined) {
      return Promise.resolve(connection);
    } else {
      throw new Error(`No connection found with name ${connectionName}.`);
    }
  }

  async lookupSchemaReader(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }

  async lookupQueryExecutor(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }
}

export class Runtime {
  private translator: Translator;
  private executor: Executor;

  constructor(
    uriFetcher: UriFetcher,
    lookupSchemaReader: LookupSchemaReader,
    lookupQueryExecutor: LookupQueryExecutor
  ) {
    this.translator = new Translator(uriFetcher, lookupSchemaReader);
    this.executor = new Executor(lookupQueryExecutor);
  }

  public async compile(model: ModelSpecification): Promise<Model>;
  public async compile(
    query: StringQuerySpecification | UriQuerySpecification,
    model?: ModelSpecification
  ): Promise<Model>;
  public async compile(
    primary: ModelSpecification | UncompiledQuerySpecification,
    base?: ModelSpecification
  ): Promise<Model> {
    return this.translator.compile(primary, base);
  }

  public async compileModel(
    model: StringModelSpecification | UriModelSpecification
  ): Promise<Model> {
    return await this.translator.compileModel(model);
  }

  public async compileQuery(
    query: StringQuerySpecification | UriQuerySpecification,
    model?: ModelSpecification
  ): Promise<Query> {
    return this.translator.compileQuery(query, model);
  }

  public async compileUnnamedQuery(
    model: ModelSpecification,
    index: number
  ): Promise<Query> {
    return this.translator.compileUnnamedQuery(model, index);
  }

  public async compileNamedQuery(
    model: ModelSpecification,
    name: string
  ): Promise<Query> {
    return this.translator.compileNamedQuery(model, name);
  }

  public async translateQuery(
    query: QuerySpecification,
    model?: ModelSpecification
  ): Promise<SqlQuery> {
    return this.translator.translateQuery(query, model);
  }

  public async translateUnnamedQuery(
    model: ModelSpecification,
    index: number
  ): Promise<SqlQuery> {
    return this.translator.translateUnnamedQuery(model, index);
  }

  public async translateNamedQuery(
    model: ModelSpecification,
    name: string
  ): Promise<SqlQuery> {
    return this.translator.translateNamedQuery(model, name);
  }

  public async translate(query: Query): Promise<SqlQuery> {
    return this.translator.translate(query);
  }

  public async execute(sqlQuery: SqlQuery): Promise<QueryResult> {
    return this.executor.execute(sqlQuery);
  }

  public async executeQuery(
    query: QuerySpecification,
    model?: ModelSpecification
  ): Promise<QueryResult> {
    return this.executor.execute(await this.translateQuery(query, model));
  }

  public async executeNamedQuery(
    model: ModelSpecification,
    name: string
  ): Promise<QueryResult> {
    return this.executor.execute(await this.translateNamedQuery(model, name));
  }

  public async executeUnnamedQuery(
    model: ModelSpecification,
    index: number
  ): Promise<QueryResult> {
    return this.executor.execute(
      await this.translateUnnamedQuery(model, index)
    );
  }
}
