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
import { LogMessage, MalloyTranslator, TranslateResponse } from "./lang";
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
  QueryExecutor,
  UriReader,
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

type SuccessfulTranslateResponse = TranslateResponse & {
  translated: {
    modelDef: ModelDef;
    queryList: Query[];
  };
};

export class MalloyError extends Error {
  public readonly log: LogMessage[];
  constructor(message: string, log: LogMessage[] = []) {
    super(message);
    this.log = log;
  }
}

class Model {
  private response: SuccessfulTranslateResponse;

  constructor(response: TranslateResponse) {
    this.response = Model.getSuccessfulTranslation(response);
  }

  private static getSuccessfulTranslation(
    response: TranslateResponse
  ): SuccessfulTranslateResponse {
    if (response.translated !== undefined) {
      return response as SuccessfulTranslateResponse;
    } else {
      const errors = response.errors || [];
      throw new MalloyError(
        `Error(s) compiling model: ${errors[0]?.message}.`,
        errors
      );
    }
  }

  public getNamedQuery(queryName: string): Query {
    const struct = this.response.translated.modelDef.structs[queryName];
    if (struct.type === "struct") {
      const source = struct.structSource;
      if (source.type === "query") {
        return new Query(source.query, this.response.translated.modelDef);
      }
    }

    throw new Error("Given query name does not refer to a named query.");
  }

  public getUnnamedQuery(index = -1): Query {
    const adjustedIndex =
      index === -1 ? this.response.translated.queryList.length - 1 : index;
    return new Query(
      this.response.translated.queryList[adjustedIndex],
      this.response.translated.modelDef
    );
  }

  public getQuery(): Query {
    return this.getUnnamedQuery();
  }

  public get _modelDef(): ModelDef {
    return this.response.translated.modelDef;
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
  private uriReader: UriReader;
  private lookupSchemaReader: LookupSchemaReader;

  constructor(uriReader: UriReader, lookupSchemaReader: LookupSchemaReader) {
    this.uriReader = uriReader;
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
          const neededText = await this.uriReader.readUri(neededUri);
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
      const string = await this.uriReader.readUri(primary.uri);
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
    const sqlQueryRunner = await this.getExecutor(sqlQuery);
    const result = await sqlQueryRunner.executeSql(sqlQuery._getRawQuery().sql);
    return {
      ...sqlQuery._getRawQuery(),
      result: result.rows,
      totalRows: result.totalRows,
    };
  }

  public getExecutor(sqlQuery: SqlQuery): Promise<QueryExecutor> {
    return this.lookupQueryExecutor.lookupQueryExecutor(
      sqlQuery.getConnectionName()
    );
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

export class EmptyUriReader implements UriReader {
  async readUri(_uri: string): Promise<string> {
    throw new Error("No files.");
  }
}

export class InMemoryUriReader implements UriReader {
  private files: Map<string, string>;

  constructor(files: Map<string, string>) {
    this.files = files;
  }

  async readUri(uri: string): Promise<string> {
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
    uriReader: UriReader,
    lookupSchemaReader: LookupSchemaReader,
    lookupQueryExecutor: LookupQueryExecutor
  ) {
    this.translator = new Translator(uriReader, lookupSchemaReader);
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

  public getExecutor(sqlQuery: SqlQuery): Promise<QueryExecutor> {
    return this.executor.getExecutor(sqlQuery);
  }
}
