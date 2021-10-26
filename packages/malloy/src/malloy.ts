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

// export class Malloy {
//   // TODO load from file built during release
//   public static get version(): string {
//     return "0.0.1";
//   }

//   private static _log: Loggable;

//   public static get log(): Loggable {
//     return Malloy._log || console;
//   }

//   public static setLogger(log: Loggable): void {
//     Malloy._log = log;
//   }
// }

export interface ConnectionMultiplexer {
  getConnection: (connectionName?: string) => Promise<Connection>;
}

export interface FileGetter {
  getFile: (uri: string) => Promise<string>;
}

export class Runtime {
  private connections: ConnectionMultiplexer;
  private files: FileGetter;

  constructor(connections: ConnectionMultiplexer, files: FileGetter) {
    this.connections = connections;
    this.files = files;
  }

  async getConnection(connectionName?: string): Promise<Connection> {
    return this.connections.getConnection(connectionName);
  }

  async getFile(uri: string): Promise<string> {
    return this.files.getFile(uri);
  }
}

class TranslationResult {
  private response: TranslateResponse;

  constructor(response: TranslateResponse) {
    this.response = response;
  }

  public getNamedQuery(queryName: string): {
    query: InternalQuery;
    model: ModelDef;
  } {
    if (this.response.translated) {
      const struct = this.response.translated.modelDef.structs[queryName];
      if (struct.type === "struct") {
        const source = struct.structSource;
        if (source.type === "query") {
          return {
            model: this.response.translated.modelDef,
            query: source.query,
          };
        }
      }

      throw new Error("Given query name does not refer to a named query.");
    }
    throw new Error("Cannot extract query from failed translation.");
  }

  public getUnnamedQuery(index = -1): {
    query: InternalQuery;
    model: ModelDef;
  } {
    if (this.response.translated) {
      const adjustedIndex =
        index === -1 ? this.response.translated.queryList.length - 1 : index;
      return {
        model: this.response.translated.modelDef,
        query: this.response.translated.queryList[adjustedIndex],
      };
    }

    throw new Error("Cannot extract query from failed translation.");
  }

  public getModel(): ModelDef {
    if (this.response.translated) {
      return this.response.translated.modelDef;
    }

    throw new Error("Cannot extract model from failed translation.");
  }
}

// Not exported, so clients cannot make one
class Model {
  modelDef: ModelDef;

  constructor(modelDef: ModelDef) {
    this.modelDef = modelDef;
  }
}

interface QueryStringAgainstCompiledModel {
  query: string;
  model: Model;
}

interface QueryString {
  query: string;
}

type QuerySpec = QueryString | QueryStringAgainstCompiledModel;

function parseTableName(connectionTableString: string) {
  const [firstPart, secondPart] = connectionTableString.split(":");
  if (secondPart) {
    return { connectionName: firstPart, tableName: secondPart };
  } else {
    return { tableName: firstPart };
  }
}

export class Malloy {
  private runtime: Runtime;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  // TODO load from file built during release
  public static get version(): string {
    return "0.0.1";
  }

  private static _log: Loggable;

  public static get log(): Loggable {
    return Malloy._log || console;
  }

  public static setLogger(log: Loggable): void {
    Malloy._log = log;
  }

  private async translate(
    uri: string,
    malloy: string,
    model?: ModelDef
  ): Promise<TranslationResult> {
    const translator = new MalloyTranslator(uri, { URLs: { [uri]: malloy } });
    translator.translate(model);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = translator.translate();
      if (result.final) {
        return new TranslationResult(result);
      } else if (result.URLs) {
        for (const neededUri of result.URLs) {
          const neededText = await this.runtime.getFile(neededUri);
          const URLs = { [neededUri]: neededText };
          translator.update({ URLs });
        }
      } else if (result.tables) {
        // collect tables by connection name since there may be multiple connections
        const tablesByConnection: Map<string, Array<string>> = new Map();
        for (const connectionTableString of result.tables) {
          const _parsed = parseTableName(connectionTableString);
          let connectionName = _parsed.connectionName;
          const tableName = _parsed.tableName;

          if (connectionName === undefined) {
            try {
              connectionName = (await this.runtime.getConnection()).name;
            } catch (error) {
              throw new Error(
                "No connection name specified and there is no default connection."
              );
            }
          }

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
          const connection = await this.runtime.getConnection(connectionName);
          const tables = await connection.getSchemaForMissingTables(tableNames);
          translator.update({ tables });
        }
      }
    }
  }

  public async compileModel(malloy: string): Promise<Model> {
    const translated = await this.translate("internal://model", malloy);
    return new Model(translated.getModel());
  }

  public async compileQuery(rawQuery: QuerySpec): Promise<SqlQuery> {
    const model = "model" in rawQuery ? rawQuery.model : undefined;
    const translated = await this.translate(
      "internal://query",
      rawQuery.query,
      model?.modelDef
    );
    const { model: queryModel, query } = translated.getUnnamedQuery();
    const compiledQuery = await new QueryModel(queryModel).compileQuery(query);
    let connectionName;
    {
      const struct =
        typeof query.structRef === "string"
          ? queryModel.structs[query.structRef]
          : query.structRef;
      if (struct.structRelationship.type !== "basetable") {
        throw new Error("Expected query to be against a table.");
      } else {
        connectionName = struct.structRelationship.connectionName;
      }
    }
    return new SqlQuery(compiledQuery, connectionName);
  }

  public async runQuery(rawQuery: QuerySpec): Promise<QueryResult> {
    const compiledQuery = await this.compileQuery(rawQuery);
    const connection = await this.runtime.getConnection(
      compiledQuery.getConnectionName()
    );
    const result = await connection.runMalloyQuery(
      compiledQuery._getRawQuery().sql
    );
    return {
      ...compiledQuery._getRawQuery(),
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

export class SingleConnection implements ConnectionMultiplexer {
  private connection: Connection;
  constructor(connection: Connection) {
    this.connection = connection;
  }

  async getConnection(connectionName?: string): Promise<Connection> {
    if (
      connectionName !== undefined &&
      connectionName !== this.connection.name
    ) {
      throw new Error("Invalid connection name");
    }
    return Promise.resolve(this.connection);
  }
}

export class NoFiles implements FileGetter {
  async getFile(_uri: string): Promise<string> {
    throw new Error("No files.");
  }
}

export class InMemoryFiles implements FileGetter {
  private files: Map<string, string>;

  constructor(files: Map<string, string>) {
    this.files = files;
  }

  async getFile(uri: string): Promise<string> {
    const file = this.files.get(uri);
    if (file !== undefined) {
      return Promise.resolve(file);
    } else {
      throw new Error("File not found.");
    }
  }
}

export class FixedConnections implements ConnectionMultiplexer {
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
}
