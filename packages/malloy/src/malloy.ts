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
  Query,
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

  private queryModel: QueryModel;

  constructor() {
    this.queryModel = new QueryModel(undefined);
  }

  public static setLogger(log: Loggable): void {
    Malloy._log = log;
  }
}

// TODO assumes single model today
export class MalloyRuntime {
  public defaultConnectionName: string | undefined;
  connectionMap = new Map<string, Connection>();

  queryModel: QueryModel | undefined;
  modelCount = 0;
  queryNumber = 0;

  public registerConection(name: string, connection: Connection): void {
    this.connectionMap.set(name, connection);
  }

  public getConnection(name: string): Connection {
    const connection = this.connectionMap.get(name);
    if (connection === undefined) {
      throw new Error(`Unknown Connection ${name}`);
    }
    return connection;
  }

  public async loadModel(model: string): Promise<void> {
    const translation = await this.translate(
      `internal://model/${this.modelCount}`,
      model
    );
    this.modelCount += 1; // TODO is this necessary? We're making a distinct translator for each model parse
    this.queryModel = new QueryModel(translation.translated?.modelDef);
  }

  public loadModelFromDefinition(modelDefinition: ModelDef): void {
    this.queryModel = new QueryModel(modelDefinition);
  }

  private async translate(
    uri: string,
    malloy: string,
    model?: ModelDef,
    uriToMalloy?: { [name: string]: string }
  ): Promise<TranslateResponse> {
    const translator = new MalloyTranslator(uri, { URLs: { [uri]: malloy } });
    translator.translate(model);

    let result = translator.translate();
    while (!result.final) {
      if (result.URLs) {
        for (const neededUri of result.URLs) {
          if (uriToMalloy) {
            const neededText = uriToMalloy[neededUri];
            if (neededText) {
              const URLs = { [neededUri]: neededText };
              translator.update({ URLs });
            } else throw new Error(`${neededUri} not provided in list of URIs`);
          } else
            throw new Error(
              "Translator asked for referenced URI but none were provided"
            );
        }
      } else if (result.tables) {
        // collect tables by connection name, as there may be multiple connections
        const tablesByConnection: Map<string, Array<string>> = new Map();
        for (const connectionTableString in result.tables) {
          const [connection, table] = connectionTableString.split(":");

          let connectionToTableMap = tablesByConnection.get(connection);
          if (!connectionToTableMap) {
            connectionToTableMap = []
            tablesByConnection.set(connection, connectionToTableMap)
          }

          if (table) {

            if (connectionToTableMap) connectionToTableMap.push(table);
            else
          }
        }
        const tables = await this.connection.getSchemaForMissingTables(
          result.tables
        );
        translator.update({ tables });
      }
      result = translator.translate();
    }

    return result;
  }

  public async computeQuery(query: string): Promise<CompiledQuery> {
    if (!this.queryModel)
      throw new Error(
        "Attempted operation on a Model instance with no model loaded"
      );

    const translation = await this.translate(
      `internal://query/${this.queryNumber}`,
      query,
      this.queryModel.modelDef
    );
    this.queryNumber += 1;

    let translatedQuery;
    if (translation.translated && translation.translated.queryList.length > 0) {
      translatedQuery =
        translation.translated.queryList[
          translation.translated.queryList.length - 1
        ];
    } else throw new Error("expected a query");

    return await this.queryModel.compileQuery(translatedQuery);
  }

  // get SQL for a Malloy query
  public async sqlForQuery(query: string): Promise<string> {
    const computedQuery = await this.computeQuery(query);
    return computedQuery.sql;
  }

  // runs a Malloy query against a connection
  public async runQuery(
    connectionName: string,
    query: string
  ): Promise<QueryResult> {
    const computedQuery = await this.computeQuery(query);
    const connection = this.getConnection(connectionName);
    const result = await connection.runMalloyQuery(computedQuery.sql);
    return {
      ...computedQuery,
      result: result.rows,
      totalRows: result.totalRows,
    };
  }

  // TODO this might be rare in the "real world" and should maybe be part of lower-level lib
  public async runQueryObject(
    connectionName: string,
    queryObject: Query
  ): Promise<QueryResult> {
    if (!this.queryModel)
      throw new Error(
        "Attempted operation on a Model instance with no model loaded"
      );

    const computedQuery = await this.queryModel.compileQuery(queryObject);
    const connection = this.getConnection(connectionName);
    const result = await connection.runMalloyQuery(computedQuery.sql);
    return {
      ...computedQuery,
      result: result.rows,
      totalRows: result.totalRows,
    };
  }
}
