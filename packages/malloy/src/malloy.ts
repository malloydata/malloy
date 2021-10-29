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
  LookupSqlRunner as LookupSqlRunner,
  LookupSchemaReader,
  ModelString,
  ModelUri,
  SqlRunner,
  QueryString,
  QueryUri,
  Uri,
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
    queryList: PreparedQuery[];
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

  public getPreparedQueryByName(queryName: string): PreparedQuery {
    const struct = this.response.translated.modelDef.structs[queryName];
    if (struct.type === "struct") {
      const source = struct.structSource;
      if (source.type === "query") {
        return new PreparedQuery(
          source.query,
          this.response.translated.modelDef
        );
      }
    }

    throw new Error("Given query name does not refer to a named query.");
  }

  public getPreparedQueryByIndex(index: number): PreparedQuery {
    const adjustedIndex =
      index === -1 ? this.response.translated.queryList.length - 1 : index;
    return new PreparedQuery(
      this.response.translated.queryList[adjustedIndex],
      this.response.translated.modelDef
    );
  }

  public getPreparedQuery(): PreparedQuery {
    return this.getPreparedQueryByIndex(-1);
  }

  public get _modelDef(): ModelDef {
    return this.response.translated.modelDef;
  }
}

export class PreparedQuery {
  _modelDef: ModelDef;
  _query: InternalQuery;

  constructor(query: InternalQuery, model: ModelDef) {
    this._query = query;
    this._modelDef = model;
  }
}

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
    uri: Uri,
    malloy: string,
    model?: ModelDef
  ): Promise<Model> {
    const translator = new MalloyTranslator(uri.toString(), {
      URLs: { [uri.toString()]: malloy },
    });
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
          const neededText = await this.uriReader.readUri(
            Uri.fromString(neededUri)
          );
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

  public async toModel(
    primaryOrBase: ModelString | ModelUri | Model,
    maybePrimary?: ModelString | ModelUri | Model | QueryString | QueryUri
  ): Promise<Model>;
  public async toModel(model: ModelString | ModelUri | Model): Promise<Model>;
  public async toModel(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri
  ): Promise<Model>;
  public async toModel(
    primaryOrBase: ModelString | ModelUri | Model,
    maybePrimary?: ModelString | ModelUri | Model | QueryString | QueryUri
  ): Promise<Model> {
    let primary: ModelString | ModelUri | Model | QueryString | QueryUri;
    let base: ModelString | ModelUri | Model | undefined;
    let model: Model | undefined;
    {
      if (maybePrimary === undefined) {
        if (primaryOrBase instanceof Model) {
          throw new Error("Oops!"); // TODO crs
        }
        primary = primaryOrBase;
      } else {
        primary = maybePrimary;
        base = primaryOrBase;
      }
    }

    if (base !== undefined) {
      if (base instanceof Model) {
        model = base;
      } else {
        model = await this.toModel(base);
      }
    }

    if (primary instanceof Model) {
      return primary;
    } else if (primary instanceof Uri) {
      const string = await this.uriReader.readUri(primary);
      return this._compile(primary, string, model?._modelDef);
    } else {
      return this._compile(
        Uri.fromString("internal://query"),
        primary,
        model?._modelDef
      );
    }
  }

  // TODO crs Maybe get rid of this function, and rename compile to toModel
  // Or else, make compile private
  // public async toModel(model: ModelString | ModelUri): Promise<Model> {
  //   return await this.compile(model);
  // }

  public async toPreparedQuery(
    queryOrModel: ModelString | ModelUri | Model | QueryString | QueryUri,
    maybeQuery?: QueryString | QueryUri
  ): Promise<PreparedQuery>;
  public async toPreparedQuery(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri
  ): Promise<PreparedQuery>;
  public async toPreparedQuery(
    query: QueryString | QueryUri
  ): Promise<PreparedQuery>;
  public async toPreparedQuery(
    queryOrModel: ModelString | ModelUri | Model | QueryString | QueryUri,
    maybeQuery?: QueryString | QueryUri
  ): Promise<PreparedQuery> {
    let model: ModelString | ModelUri | Model | undefined;
    let query: QueryString | QueryUri | PreparedQuery;
    if (maybeQuery === undefined) {
      if (queryOrModel instanceof Model) {
        throw new Error("Illegal invocation.!"); // TODO crs
      }
      query = queryOrModel;
    } else {
      query = maybeQuery;
      model = queryOrModel;
    }
    // TODO crs swap order in this function too
    return (await this.toModel(query, model)).getPreparedQuery();
  }

  public async toPreparedQueryByIndex(
    model: ModelString | ModelUri | Model,
    index: number
  ): Promise<PreparedQuery> {
    return (await this.toModel(model)).getPreparedQueryByIndex(index);
  }

  public async toPreparedQueryByName(
    model: ModelString | ModelUri | Model,
    name: string
  ): Promise<PreparedQuery> {
    return (await this.toModel(model)).getPreparedQueryByName(name);
  }

  public async toPreparedSql(
    queryOrModel:
      | ModelString
      | ModelUri
      | Model
      | QueryString
      | QueryUri
      | PreparedQuery,
    maybeQuery?: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql>;
  public async toPreparedSql(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql>;
  public async toPreparedSql(
    query: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql>;
  public async toPreparedSql(
    queryOrModel:
      | ModelString
      | ModelUri
      | Model
      | QueryString
      | QueryUri
      | PreparedQuery,
    maybeQuery?: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql> {
    let model: ModelString | ModelUri | Model | undefined;
    let query: QueryString | QueryUri | PreparedQuery;
    {
      if (maybeQuery === undefined) {
        if (queryOrModel instanceof Model) {
          throw new Error("Illegal invocation.!"); // TODO crs
        }
        query = queryOrModel;
      } else {
        if (queryOrModel instanceof PreparedQuery) {
          throw new Error("Illegal invocation."); // TODO crs
        }
        query = maybeQuery;
        model = queryOrModel;
      }
    }
    if (query instanceof PreparedQuery) {
      const queryModel = new QueryModel(query._modelDef);
      return new PreparedSql(await queryModel.compileQuery(query._query));
    } else {
      return this.toPreparedSql(
        (await this.toModel(query, model)).getPreparedQuery()
      );
    }
  }

  public async toPreparedSqlByIndex(
    model: ModelString | ModelUri | Model,
    index: number
  ): Promise<PreparedSql> {
    return this.toPreparedSql(
      (await this.toModel(model)).getPreparedQueryByIndex(index)
    );
  }

  public async toPreparedSqlByName(
    model: ModelString | ModelUri | Model,
    name: string
  ): Promise<PreparedSql> {
    return this.toPreparedSql(
      (await this.toModel(model)).getPreparedQueryByName(name)
    );
  }
}

export class Runner {
  private lookupQueryExecutor: LookupSqlRunner;

  constructor(lookupQueryExecutor: LookupSqlRunner) {
    this.lookupQueryExecutor = lookupQueryExecutor;
  }

  public async runPreparedSql(sqlQuery: PreparedSql): Promise<QueryResult> {
    const sqlQueryRunner = await this.getSqlRunner(sqlQuery);
    const result = await sqlQueryRunner.runSql(sqlQuery._getRawQuery().sql);
    return {
      ...sqlQuery._getRawQuery(),
      result: result.rows,
      totalRows: result.totalRows,
    };
  }

  public getSqlRunner(sqlQuery: PreparedSql): Promise<SqlRunner> {
    return this.lookupQueryExecutor.lookupQueryRunner(
      sqlQuery.getConnectionName()
    );
  }
}

export class PreparedSql {
  private query: CompiledQuery;
  // TODO crs compiledQuery already has .connectionName

  constructor(query: CompiledQuery) {
    this.query = query;
  }

  public getConnectionName(): string {
    return this.query.connectionName;
  }

  public _getRawQuery(): CompiledQuery {
    return this.query;
  }

  getSql(): string {
    return this.query.sql;
  }
}

export class EmptyUriReader implements UriReader {
  async readUri(_uri: Uri): Promise<string> {
    throw new Error("No files.");
  }
}

export class InMemoryUriReader implements UriReader {
  private files: Map<Uri, string>;

  constructor(files: Map<Uri, string>) {
    this.files = files;
  }

  async readUri(uri: Uri): Promise<string> {
    const file = this.files.get(uri);
    if (file !== undefined) {
      return Promise.resolve(file);
    } else {
      throw new Error("File not found.");
    }
  }
}

export class FixedConnections implements LookupSchemaReader, LookupSqlRunner {
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

  async lookupQueryRunner(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }
}

export class Runtime {
  private translator: Translator;
  private runner: Runner;

  constructor(
    uriReader: UriReader,
    lookupSchemaReader: LookupSchemaReader,
    lookupQueryExecutor: LookupSqlRunner
  ) {
    this.translator = new Translator(uriReader, lookupSchemaReader);
    this.runner = new Runner(lookupQueryExecutor);
  }

  public async toModel(
    primaryOrBase: ModelString | ModelUri | Model,
    maybePrimary?: ModelString | ModelUri | Model | QueryString | QueryUri
  ): Promise<Model>;
  public async toModel(model: ModelString | ModelUri | Model): Promise<Model>;
  public async toModel(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri
  ): Promise<Model>;
  public async toModel(
    primaryOrBase: ModelString | ModelUri | Model,
    maybePrimary?: ModelString | ModelUri | Model | QueryString | QueryUri
  ): Promise<Model> {
    return await this.translator.toModel(primaryOrBase, maybePrimary);
  }

  // toPreparedQuery
  public async toPreparedQuery(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri
  ): Promise<PreparedQuery>;
  public async toPreparedQuery(
    query: QueryString | QueryUri
  ): Promise<PreparedQuery>;
  public async toPreparedQuery(
    queryOrModel: ModelString | ModelUri | Model | QueryString | QueryUri,
    maybeQuery?: QueryString | QueryUri
  ): Promise<PreparedQuery> {
    return this.translator.toPreparedQuery(queryOrModel, maybeQuery);
  }

  public async toPreparedQueryByIndex(
    model: ModelString | ModelUri | Model,
    index: number
  ): Promise<PreparedQuery> {
    return this.translator.toPreparedQueryByIndex(model, index);
  }

  public async toPreparedQueryByName(
    model: ModelString | ModelUri | Model,
    name: string
  ): Promise<PreparedQuery> {
    return this.translator.toPreparedQueryByName(model, name);
  }

  public async toPreparedSql(
    queryOrModel:
      | ModelString
      | ModelUri
      | Model
      | QueryString
      | QueryUri
      | PreparedQuery,
    maybeQuery?: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql>;
  public async toPreparedSql(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql>;
  public async toPreparedSql(
    query: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql>;
  public async toPreparedSql(
    queryOrModel:
      | ModelString
      | ModelUri
      | Model
      | QueryString
      | QueryUri
      | PreparedQuery,
    maybeQuery?: QueryString | QueryUri | PreparedQuery
  ): Promise<PreparedSql> {
    return this.translator.toPreparedSql(queryOrModel, maybeQuery);
  }

  public async toPreparedSqlByIndex(
    model: ModelString | ModelUri | Model,
    index: number
  ): Promise<PreparedSql> {
    return this.translator.toPreparedSqlByIndex(model, index);
  }

  public async toPreparedSqlByName(
    model: ModelString | ModelUri | Model,
    name: string
  ): Promise<PreparedSql> {
    return this.translator.toPreparedSqlByName(model, name);
  }

  // run
  public async runPreparedSql(sqlQuery: PreparedSql): Promise<QueryResult> {
    return this.runner.runPreparedSql(sqlQuery);
  }

  // run
  public async run(preparedSql: PreparedSql): Promise<QueryResult>;
  public async run(
    model: ModelString | ModelUri | Model,
    query: QueryString | QueryUri | PreparedQuery
  ): Promise<QueryResult>;
  public async run(
    query: QueryString | QueryUri | PreparedQuery
  ): Promise<QueryResult>;
  public async run(
    queryOrModelOrSql:
      | ModelString
      | ModelUri
      | Model
      | QueryString
      | QueryUri
      | PreparedQuery
      | PreparedSql,
    maybeQuery?: QueryString | QueryUri | PreparedQuery
  ): Promise<QueryResult> {
    const preparedSql =
      queryOrModelOrSql instanceof PreparedSql
        ? queryOrModelOrSql
        : await this.toPreparedSql(queryOrModelOrSql, maybeQuery);
    return this.runner.runPreparedSql(preparedSql);
  }

  public async runByName(
    model: ModelString | ModelUri | Model,
    name: string
  ): Promise<QueryResult> {
    return this.runner.runPreparedSql(
      await this.toPreparedSqlByName(model, name)
    );
  }

  public async runByIndex(
    model: ModelString | ModelUri | Model,
    index: number
  ): Promise<QueryResult> {
    return this.runner.runPreparedSql(
      await this.toPreparedSqlByIndex(model, index)
    );
  }

  public getSqlRunner(preparedSql: PreparedSql): Promise<SqlRunner> {
    return this.runner.getSqlRunner(preparedSql);
  }
}

// interface Explore {
//   getFields(): Field[];
// }

// interface Field {
//   name(): string;
// }

// interface AtomicField extends Field {
//   isAggregate(): this is Measure;
// }

// interface Dimension extends Field {

// }

// interface Measure extends Field {

// }

// interface Query extends Field {

// }

// class JoinedExplore extends Field, Explore {
//   name();
// }

// class PreparedQuery {

// }

// renaming Executor to Runner
// renaming Executor.execute to run
// renameing Connection.executeSql to runSql
// rename SqlQuery to PreparedSql
// rename Query to PreparedQuery
// model comes before query

// const runtime = new Runtime();

// const preparedSql = runtime.toPreparedSql("explore foo...");
// const sql = preparedSql.getSql();
// preparedSql.getExplore().getFields()
// runtime.run(preparedSql);

// runtime.run("explore foo");

// const model = runtime.toModel("define flights is ('examples.flights' flight_count is count());");
// const result = runtime.run("flights | reduce flight_count");
// const result = runtime.run(model, "flights | reduce flight_count");
// const result2 = runtime.runByName(model, "flights_by_carrier");

// // A `malloy.Query` has some refs in it
// // A `malloy.PreparedQuery` has a `malloy.Query` and the associated explore to get refs from.

// // a Query is a structRef + pipeline + filters
// // a PreparedQuery is a (stuctRef + pipeline + filters) + a modelDef
