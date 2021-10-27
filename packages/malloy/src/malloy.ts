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
  MalloyQueryData,
  ModelDef,
  Query as InternalQuery,
  QueryModel,
  QueryResult,
  StructDef,
} from "./model";

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

// TODO URI fetcher sounds like it is fetching uris
export interface UriFetcher {
  fetchUriContents: (uri: string) => Promise<string>;
}

export interface SchemaFetcher {
  // TODO should we really be exposing StructDef like this?
  // TODO should this be a Map instead of a Record in the public interface?
  fetchSchemaForTables(tables: string[]): Promise<Record<string, StructDef>>;
}

export interface SchemaFetcherGetter {
  getSchemaFetcher(connectionName?: string): Promise<SchemaFetcher>;
}

class Model {
  private response: TranslateResponse;

  constructor(response: TranslateResponse) {
    this.response = response;
  }

  public getNamedQuery(queryName: string): Query {
    if (this.response.translated) {
      const struct = this.response.translated.modelDef.structs[queryName];
      if (struct.type === "struct") {
        const source = struct.structSource;
        if (source.type === "query") {
          return new Query(source.query, this.response.translated.modelDef);
        }
      }

      throw new Error("Given query name does not refer to a named query.");
    }
    throw new Error("Cannot extract query from failed translation.");
  }

  public getUnnamedQuery(index = -1): Query {
    if (this.response.translated) {
      const adjustedIndex =
        index === -1 ? this.response.translated.queryList.length - 1 : index;
      return new Query(
        this.response.translated.queryList[adjustedIndex],
        this.response.translated.modelDef
      );
    }

    throw new Error("Cannot extract query from failed translation.");
  }

  public getQuery(): Query {
    return this.getUnnamedQuery();
  }

  public get _modelDef(): ModelDef {
    if (this.response.translated) {
      return this.response.translated.modelDef;
    }

    throw new Error("Cannot extract model from failed translation.");
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

export type ModelSpecification =
  | StringModelSpecification
  | UriModelSpecification
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

export type QuerySpecification =
  | StringQuerySpecification
  | UriQuerySpecification
  | CompiledQuerySpecification;

interface QueryStringAgainstCompiledModel {
  query: string;
  model: Model;
}

interface QueryString {
  query: string;
}

interface QueryStringAgainstModelFile {
  query: string;
  modelUri: string;
}

export type QuerySpec =
  | QueryString
  | QueryStringAgainstCompiledModel
  | QueryStringAgainstModelFile;

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
  private schemaFetcherGetter: SchemaFetcherGetter;

  constructor(
    uriFetcher: UriFetcher,
    schemaFetcherGetter: SchemaFetcherGetter
  ) {
    this.uriFetcher = uriFetcher;
    this.schemaFetcherGetter = schemaFetcherGetter;
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
          const schemaFetcher = await this.schemaFetcherGetter.getSchemaFetcher(
            connectionName
          );
          const tables = await schemaFetcher.fetchSchemaForTables(tableNames);
          translator.update({ tables });
        }
      }
    }
  }

  public async compile(
    model:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification
  ): Promise<Model>;
  public async compile(
    query: StringQuerySpecification | UriQuerySpecification,
    model?:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification
  ): Promise<Model>;
  public async compile(
    primary:
      | StringModelSpecification
      | UriModelSpecification
      | StringQuerySpecification
      | UriQuerySpecification
      | CompiledModelSpecification,
    base?:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification
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
    model: StringModelSpecification | UriModelSpecification
  ): Promise<Model> {
    return await this.compile(model);
  }

  public async compileQuery(
    query: StringQuerySpecification | UriQuerySpecification,
    model?:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification
  ): Promise<Query> {
    return (await this.compile(query, model)).getUnnamedQuery();
  }

  public async compileUnnamedQuery(
    model:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification,
    index: number
  ): Promise<Query> {
    return (await this.compile(model)).getUnnamedQuery(index);
  }

  public async compileNamedQuery(
    model:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification,
    name: string
  ): Promise<Query> {
    return (await this.compile(model)).getNamedQuery(name);
  }

  public async translateQuery(
    query:
      | StringQuerySpecification
      | UriQuerySpecification
      | CompiledQuerySpecification,
    model?:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification
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
    model:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification,
    index: number
  ): Promise<SqlQuery> {
    return this.translate((await this.compile(model)).getUnnamedQuery(index));
  }

  public async translateNamedQuery(
    model:
      | StringModelSpecification
      | UriModelSpecification
      | CompiledModelSpecification,
    index: number
  ): Promise<SqlQuery> {
    return this.translate((await this.compile(model)).getUnnamedQuery(index));
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

export interface SqlQueryRunner {
  runSqlQuery(sql: string): Promise<MalloyQueryData>;
}

export interface SqlQueryRunnerGetter {
  getSqlQueryRunner(connectionName?: string): Promise<SqlQueryRunner>;
}

export class Runner {
  private sqlQueryRunnerGetter: SqlQueryRunnerGetter;

  constructor(sqlQueryRunnerGetter: SqlQueryRunnerGetter) {
    this.sqlQueryRunnerGetter = sqlQueryRunnerGetter;
  }

  public async execute(sqlQuery: SqlQuery): Promise<QueryResult> {
    const sqlQueryRunner = await this.sqlQueryRunnerGetter.getSqlQueryRunner(
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
  implements SchemaFetcherGetter, SqlQueryRunnerGetter
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

  async getSchemaFetcher(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }

  async getSqlQueryRunner(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }
}
