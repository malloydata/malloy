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
import { LogMessage, MalloyTranslator } from "./lang";
import {
  CompiledQuery,
  FieldTypeDef,
  FilterExpression,
  ModelDef,
  Query as InternalQuery,
  QueryData,
  QueryModel,
  QueryResult,
  StructDef,
  TurtleDef,
} from "./model";
import {
  LookupSQLRunner,
  LookupSchemaReader,
  ModelString,
  ModelURL,
  SQLRunner,
  QueryString,
  QueryURL,
  URL,
  URLReader,
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

export class MalloyError extends Error {
  public readonly log: LogMessage[];
  constructor(message: string, log: LogMessage[] = []) {
    super(message);
    this.log = log;
  }
}

export class Model {
  private modelDef: ModelDef;
  private queryList: InternalQuery[];

  constructor(modelDef: ModelDef, queryList: InternalQuery[]) {
    this.modelDef = modelDef;
    this.queryList = queryList;
  }

  public getPreparedQueryByName(queryName: string): PreparedQuery {
    const struct = this.modelDef.structs[queryName];
    if (struct.type === "struct") {
      const source = struct.structSource;
      if (source.type === "query") {
        return new PreparedQuery(source.query, this.modelDef, queryName);
      }
    }

    throw new Error("Given query name does not refer to a named query.");
  }

  public getPreparedQueryByIndex(index: number): PreparedQuery {
    if (index < 0) {
      throw new Error(`Invalid index ${index}.`);
    } else if (index >= this.queryList.length) {
      throw new Error(`Query index ${index} is out of bounds.`);
    }
    return new PreparedQuery(this.queryList[index], this.modelDef);
  }

  /*
   * Get this model's final unnamed query.
   */
  public getPreparedQuery(): PreparedQuery {
    if (this.queryList.length < 0) {
      throw new Error("Model has no queries.");
    }
    return new PreparedQuery(
      this.queryList[this.queryList.length - 1],
      this.modelDef
    );
  }

  public getExploreByName(name: string): Explore {
    return new Explore(this.modelDef.structs[name]);
  }

  public getExplores(): Explore[] {
    return Object.keys(this.modelDef.structs).map((name) =>
      this.getExploreByName(name)
    );
  }

  public _getModelDef(): ModelDef {
    return this.modelDef;
  }
}

export class PreparedQuery {
  private _modelDef: ModelDef;
  private _query: InternalQuery;
  private name?: string;

  constructor(query: InternalQuery, model: ModelDef, name?: string) {
    this._query = query;
    this._modelDef = model;
    this.name = name;
  }

  public getPreparedResult(): PreparedResult {
    const queryModel = new QueryModel(this._modelDef);
    const translatedQuery = queryModel.compileQuery(this._query);
    return new PreparedResult({
      queryName: this.name || translatedQuery.queryName,
      ...translatedQuery,
    });
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

export class Compiler {
  private urlReader: URLReader;
  private lookupSchemaReader: LookupSchemaReader;

  constructor(urlReader: URLReader, lookupSchemaReader: LookupSchemaReader) {
    this.urlReader = urlReader;
    this.lookupSchemaReader = lookupSchemaReader;
  }

  private async _compile(
    url: URL,
    malloy: string,
    model?: ModelDef
  ): Promise<{ modelDef: ModelDef; queryList: InternalQuery[] }> {
    const translator = new MalloyTranslator(url.toString(), {
      urls: { [url.toString()]: malloy },
    });
    translator.translate(model);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = translator.translate();
      if (result.final) {
        if (result.translated) {
          return {
            modelDef: result.translated.modelDef,
            queryList: result.translated.queryList,
          };
        } else {
          const errors = result.errors || [];
          throw new MalloyError(
            `Error(s) compiling model: ${errors[0]?.message}.`,
            errors
          );
        }
      } else if (result.urls) {
        for (const neededURL of result.urls) {
          if (neededURL.startsWith("internal://")) {
            throw new Error(
              "In order to use relative imports, you must compile a file via a URL."
            );
          }
          const neededText = await this.urlReader.readURL(
            URL.fromString(neededURL)
          );
          const urls = { [neededURL]: neededText };
          translator.update({ urls });
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

  private async toURLAndContents(source: URL | string) {
    if (source instanceof URL) {
      const contents = await this.urlReader.readURL(source);
      return { contents, url: source };
    } else {
      return {
        contents: source,
        url: URL.fromString("internal://internal.malloy"),
      };
    }
  }

  public async makeModel(model: ModelString | ModelURL): Promise<Model>;
  public async makeModel(
    model: ModelString | ModelURL | Model,
    query: QueryString | QueryURL
  ): Promise<Model>;
  public async makeModel(
    primaryOrBase: ModelString | ModelURL | Model,
    maybePrimary?: ModelString | ModelURL | QueryString | QueryURL
  ): Promise<Model> {
    let primary: ModelString | ModelURL | QueryString | QueryURL;
    let base: ModelString | ModelURL | Model | undefined;
    if (maybePrimary === undefined) {
      if (primaryOrBase instanceof Model) {
        throw new Error(
          "Internal error: last parameter cannot already be a compiled model."
        );
      }
      primary = primaryOrBase;
    } else {
      primary = maybePrimary;
      base = primaryOrBase;
    }
    let model: ModelDef | undefined;

    if (base !== undefined) {
      if (base instanceof Model) {
        model = base._getModelDef();
      } else {
        const { url, contents } = await this.toURLAndContents(base);
        model = (await this._compile(url, contents)).modelDef;
      }
    }

    const { url, contents } = await this.toURLAndContents(primary);
    const { modelDef, queryList } = await this._compile(url, contents, model);
    return new Model(modelDef, queryList);
  }
}

export class Runner {
  private lookupSQLRunner: LookupSQLRunner;

  constructor(lookupSQLRunner: LookupSQLRunner) {
    this.lookupSQLRunner = lookupSQLRunner;
  }

  public async run(
    preparedSQL: PreparedResult | Promise<PreparedResult>
  ): Promise<Result> {
    preparedSQL = await preparedSQL;
    const sqlRunner = await this.getSQLRunner(preparedSQL.getConnectionName());
    return Runner.run(sqlRunner, preparedSQL);
  }

  public getSQLRunner(connectionName: string): Promise<SQLRunner> {
    return this.lookupSQLRunner.lookupSQLRunner(connectionName);
  }

  public static async run(
    sqlRunner: SQLRunner,
    preparedSQL: PreparedResult | Promise<PreparedResult>
  ): Promise<Result> {
    preparedSQL = await preparedSQL;
    const result = await sqlRunner.runSQL(preparedSQL.getSQL());
    return new Result({
      ...preparedSQL._getRawQuery(),
      result: result.rows,
      totalRows: result.totalRows,
    });
  }
}

export class PreparedResult {
  protected inner: CompiledQuery;

  constructor(query: CompiledQuery) {
    this.inner = query;
  }

  public getConnectionName(): string {
    return this.inner.connectionName;
  }

  public _getRawQuery(): CompiledQuery {
    return this.inner;
  }

  public getSQL(): string {
    return this.inner.sql;
  }

  public getResultExplore(): Explore {
    if (this.inner.structs.length === 0) {
      throw new Error("Malformed query result.");
    }
    const explore = this.inner.structs[this.inner.structs.length - 1];
    const namedExplore = {
      ...explore,
      name: this.inner.queryName || explore.name,
    };
    return new Explore(namedExplore);
  }

  public _getSourceExploreName(): string {
    return this.inner.sourceExplore;
  }

  public _getSourceFilters(): FilterExpression[] {
    return this.inner.sourceFilters || [];
  }
}

export class EmptyURLReader implements URLReader {
  async readURL(_url: URL): Promise<string> {
    throw new Error("No files.");
  }
}

export class InMemoryURLReader implements URLReader {
  private files: Map<string, string>;

  constructor(files: Map<string, string>) {
    this.files = files;
  }

  public async readURL(url: URL): Promise<string> {
    const file = this.files.get(url.toString());
    if (file !== undefined) {
      return Promise.resolve(file);
    } else {
      throw new Error(`File not found '${url}'`);
    }
  }
}

export class FixedConnectionMap implements LookupSchemaReader, LookupSQLRunner {
  private connections: Map<string, Connection>;
  private defaultConnectionName?: string;
  constructor(
    connections: Map<string, Connection>,
    defaultConnectionName?: string
  ) {
    this.connections = connections;
    this.defaultConnectionName = defaultConnectionName;
  }

  public async getConnection(connectionName?: string): Promise<Connection> {
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

  public async lookupSchemaReader(
    connectionName?: string
  ): Promise<Connection> {
    return this.getConnection(connectionName);
  }

  public async lookupSQLRunner(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }
}

export enum SourceRelationship {
  Nested = "nested",
  Condition = "condition",
  BaseTable = "base_table",
  ForeignKey = "foreign_key",
  Inline = "inline",
}

export type Field = AtomicField | QueryField | ExploreField;

export class Explore {
  protected readonly structDef: StructDef;
  protected readonly parentExplore?: Explore;
  private fields: Map<string, Field> | undefined;

  public getName(): string {
    return this.structDef.as || this.structDef.name;
  }

  constructor(structDef: StructDef, parentExplore?: Explore) {
    this.structDef = structDef;
    this.parentExplore = parentExplore;
  }

  public _getStructDef(): StructDef {
    return this.structDef;
  }

  public getQueryByName(name: string): PreparedQuery {
    const internalQuery: InternalQuery = {
      type: "query",
      structRef: this.structDef,
      pipeline: [
        {
          type: "reduce",
          fields: [name],
        },
      ],
    };
    return new PreparedQuery(internalQuery, this.getModelDef());
  }

  private getModelDef(): ModelDef {
    return {
      name: "generated_model",
      exports: [],
      structs: { [this.structDef.name]: this.structDef },
    };
  }

  public getSingleExploreModel(): Model {
    return new Model(this.getModelDef(), []);
  }

  private getFieldMap(): Map<string, Field> {
    if (this.fields === undefined) {
      this.fields = new Map(
        this.structDef.fields.map((fieldDef) => {
          const name = fieldDef.as || fieldDef.name;
          if (fieldDef.type === "struct") {
            return [name, new ExploreField(fieldDef, this)];
          } else if (fieldDef.type === "turtle") {
            return [name, new QueryField(fieldDef)];
          } else {
            return [name, new AtomicField(fieldDef)];
          }
        }) as [string, Field][]
      );
    }
    return this.fields;
  }

  public getFields(): Field[] {
    return [...this.getFieldMap().values()];
  }

  public getFieldByName(fieldName: string): Field {
    const field = this.getFieldMap().get(fieldName);
    if (field === undefined) {
      throw new Error(`No such field ${fieldName}.`);
    }
    return field;
  }

  public getPrimaryKey(): string | undefined {
    return this.structDef.primaryKey;
  }

  public getParentExplore(): Explore | undefined {
    return this.parentExplore;
  }

  public getSourceRelationship(): SourceRelationship {
    switch (this.structDef.structRelationship.type) {
      case "condition":
        return SourceRelationship.Condition;
      case "foreignKey":
        return SourceRelationship.ForeignKey;
      case "inline":
        return SourceRelationship.Inline;
      case "nested":
        return SourceRelationship.Nested;
      case "basetable":
        return SourceRelationship.BaseTable;
    }
  }

  public hasParentExplore(): this is ExploreField {
    return this instanceof ExploreField;
  }
}

export enum AtomicFieldType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
  Date = "date",
  Timestamp = "timestamp",
}

export class AtomicField {
  private fieldTypeDef: FieldTypeDef;

  constructor(fieldTypeDef: FieldTypeDef) {
    this.fieldTypeDef = fieldTypeDef;
  }

  public getName(): string {
    return this.fieldTypeDef.as || this.fieldTypeDef.name;
  }

  public getType(): AtomicFieldType {
    switch (this.fieldTypeDef.type) {
      case "string":
        return AtomicFieldType.String;
      case "boolean":
        return AtomicFieldType.Boolean;
      case "date":
        return AtomicFieldType.Date;
      case "timestamp":
        return AtomicFieldType.Timestamp;
      case "number":
        return AtomicFieldType.Number;
    }
  }

  public isQueryField(): this is QueryField {
    return false;
  }

  public isExploreField(): this is ExploreField {
    return false;
  }

  public isAtomicField(): this is AtomicField {
    return true;
  }

  public isAggregate(): boolean {
    return !!this.fieldTypeDef.aggregate;
  }
}

export class QueryField {
  private turtleDef: TurtleDef;

  constructor(turtleDef: TurtleDef) {
    this.turtleDef = turtleDef;
  }

  public getName(): string {
    return this.turtleDef.as || this.turtleDef.name;
  }

  public isQueryField(): this is QueryField {
    return true;
  }

  public isExploreField(): this is ExploreField {
    return false;
  }

  public isAtomicField(): this is AtomicField {
    return false;
  }
}

export enum JoinRelationship {
  OneToOne = "one_to_one",
  OneToMany = "one_to_many",
  ManyToOne = "many_to_one",
}

export class ExploreField extends Explore {
  protected parentExplore: Explore;

  constructor(structDef: StructDef, parentExplore: Explore) {
    super(structDef, parentExplore);
    this.parentExplore = parentExplore;
  }

  public getJoinRelationship(): JoinRelationship {
    switch (this.structDef.structRelationship.type) {
      case "condition":
      case "foreignKey":
        return JoinRelationship.OneToMany;
      case "inline":
        return JoinRelationship.OneToOne;
      case "nested":
        return JoinRelationship.ManyToOne;
      default:
        throw new Error("An explore field must have a join relationship.");
    }
  }

  public isQueryField(): this is QueryField {
    return false;
  }

  public isExploreField(): this is ExploreField {
    return true;
  }

  public isAtomicField(): this is AtomicField {
    return false;
  }

  public getParentExplore(): Explore {
    return this.parentExplore;
  }
}

export class Runtime {
  private compiler: Compiler;
  private runner: Runner;

  constructor(runtime: LookupSchemaReader & LookupSQLRunner & URLReader);
  constructor(
    urls: URLReader,
    connections: LookupSchemaReader & LookupSQLRunner
  );
  constructor(
    urls: URLReader,
    schemas: LookupSchemaReader,
    connections: LookupSQLRunner
  );
  constructor(connections: LookupSchemaReader & LookupSQLRunner);
  constructor(schemas: LookupSchemaReader, connections: LookupSQLRunner);
  constructor(...args: (URLReader | LookupSchemaReader | LookupSQLRunner)[]) {
    let urlReader: URLReader | undefined;
    let lookupSchemaReader: LookupSchemaReader | undefined;
    let lookupSQLRunner: LookupSQLRunner | undefined;
    for (const arg of args) {
      if (isURLReader(arg)) {
        urlReader = arg;
      }
      if (isLookupSchemaReader(arg)) {
        lookupSchemaReader = arg;
      }
      if (isLookupSQLRunner(arg)) {
        lookupSQLRunner = arg;
      }
    }
    if (urlReader === undefined) {
      urlReader = new EmptyURLReader();
    }
    if (lookupSchemaReader === undefined) {
      throw new Error("A LookupSchemaReader is required.");
    }
    if (lookupSQLRunner === undefined) {
      throw new Error("A LookupSQLReader is required.");
    }
    this.compiler = new Compiler(urlReader, lookupSchemaReader);
    this.runner = new Runner(lookupSQLRunner);
  }

  public loadModel(source: ModelURL | ModelString): ModelMaterializer {
    const compiler = this.getCompiler();
    return new ModelMaterializer(this, function materialize() {
      return compiler.makeModel(source);
    });
  }

  // TODO Consider formalizing this. Perhaps as a `withModel` method,
  //      as well as a `Model.fromModelDefinition` if we choose to expose
  //      `ModelDef` to the world formally. For now, this should only
  //      be used in tests.
  public _loadModelFromModelDef(modelDef: ModelDef): ModelMaterializer {
    return new ModelMaterializer(this, async function materialize() {
      return new Model(modelDef, []);
    });
  }

  public loadQuery(query: QueryURL | QueryString): QueryMaterializer {
    return this.loadModel(query).loadFinalQuery();
  }

  public loadQueryByIndex(
    model: ModelURL | ModelString,
    index: number
  ): QueryMaterializer {
    return this.loadModel(model).loadQueryByIndex(index);
  }

  public loadQueryByName(
    model: ModelURL | ModelString,
    name: string
  ): QueryMaterializer {
    return this.loadModel(model).loadQueryByName(name);
  }

  // TODO maybe use overloads for the alternative parameters
  public getModel(source: ModelURL | ModelString): Promise<Model> {
    return this.loadModel(source).getModel();
  }

  public getQuery(query: QueryURL | QueryString): Promise<PreparedQuery> {
    return this.loadQuery(query).getPreparedQuery();
  }

  public getQueryByIndex(
    model: ModelURL | ModelString,
    index: number
  ): Promise<PreparedQuery> {
    return this.loadQueryByIndex(model, index).getPreparedQuery();
  }

  public getQueryByName(
    model: ModelURL | ModelString,
    name: string
  ): Promise<PreparedQuery> {
    return this.loadQueryByName(model, name).getPreparedQuery();
  }

  public getRunner(): Runner {
    return this.runner;
  }

  public getCompiler(): Compiler {
    return this.compiler;
  }
}

class FluentState<T> {
  protected runtime: Runtime;
  private readonly _materialize: () => Promise<T>;
  private materialized: Promise<T> | undefined;

  constructor(runtime: Runtime, materialize: () => Promise<T>) {
    this.runtime = runtime;
    this._materialize = materialize;
  }

  protected materialize(): Promise<T> {
    if (this.materialized === undefined) {
      return this.rematerialize();
    }
    return this.materialized;
  }

  protected rematerialize(): Promise<T> {
    this.materialized = this._materialize();
    return this.materialized;
  }

  protected makeQueryMaterializer(
    materialize: () => Promise<PreparedQuery>
  ): QueryMaterializer {
    return new QueryMaterializer(this.runtime, materialize);
  }

  protected makeExploreMaterializer(
    materialize: () => Promise<Explore>
  ): ExploreMaterializer {
    return new ExploreMaterializer(this.runtime, materialize);
  }

  protected makePreparedResultMaterializer(
    materialize: () => Promise<PreparedResult>
  ): PreparedResultMaterializer {
    return new PreparedResultMaterializer(this.runtime, materialize);
  }
}

export class ModelMaterializer extends FluentState<Model> {
  public loadFinalQuery(): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQuery();
    });
  }

  public loadQueryByIndex(index: number): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQueryByIndex(index);
    });
  }

  public loadQueryByName(name: string): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQueryByName(name);
    });
  }

  public loadQuery(query: QueryString | QueryURL): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      const model = await this.runtime
        .getCompiler()
        .makeModel(await this.materialize(), query);
      return model.getPreparedQuery();
    });
  }

  public getFinalQuery(): Promise<PreparedQuery> {
    return this.loadFinalQuery().getPreparedQuery();
  }

  public getQueryByIndex(index: number): Promise<PreparedQuery> {
    return this.loadQueryByIndex(index).getPreparedQuery();
  }

  public getQueryByName(name: string): Promise<PreparedQuery> {
    return this.loadQueryByName(name).getPreparedQuery();
  }

  public getQuery(query: QueryString | QueryURL): Promise<PreparedQuery> {
    return this.loadQuery(query).getPreparedQuery();
  }

  // TODO Consider formalizing this. Perhaps as a `withQuery` method,
  //      as well as a `PreparedQuery.fromQueryDefinition` if we choose to expose
  //      `InternalQuery` to the world formally. For now, this should only
  //      be used in tests.
  public _loadQueryFromQueryDef(query: InternalQuery): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      const model = await this.materialize();
      return new PreparedQuery(query, model._getModelDef());
    });
  }

  public loadExploreByName(name: string): ExploreMaterializer {
    return this.makeExploreMaterializer(async () => {
      return (await this.materialize()).getExploreByName(name);
    });
  }

  public getExploreByName(name: string): Promise<Explore> {
    return this.loadExploreByName(name).getExplore();
  }

  public getModel(): Promise<Model> {
    return this.materialize();
  }
}

class QueryMaterializer extends FluentState<PreparedQuery> {
  async run(): Promise<Result> {
    return this.runtime
      .getRunner()
      .run(await this.loadPreparedResult().getPreparedResult());
  }

  public loadPreparedResult(): PreparedResultMaterializer {
    return this.makePreparedResultMaterializer(async () => {
      return (await this.materialize()).getPreparedResult();
    });
  }

  public getPreparedResult(): Promise<PreparedResult> {
    return this.loadPreparedResult().getPreparedResult();
  }

  public async getSQL(): Promise<string> {
    return (await this.getPreparedResult()).getSQL();
  }

  public getPreparedQuery(): Promise<PreparedQuery> {
    return this.materialize();
  }
}

class PreparedResultMaterializer extends FluentState<PreparedResult> {
  async run(): Promise<Result> {
    const preparedSQL = await this.materialize();
    return this.runtime.getRunner().run(preparedSQL);
  }

  public getPreparedResult(): Promise<PreparedResult> {
    return this.materialize();
  }

  public async getSQL(): Promise<string> {
    return (await this.getPreparedResult()).getSQL();
  }
}

class ExploreMaterializer extends FluentState<Explore> {
  public loadQueryByName(name: string): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getQueryByName(name);
    });
  }

  public getQueryByName(name: string): Promise<PreparedQuery> {
    return this.loadQueryByName(name).getPreparedQuery();
  }

  public getExplore(): Promise<Explore> {
    return this.materialize();
  }
}

export class Result extends PreparedResult {
  protected inner: QueryResult;

  constructor(queryResult: QueryResult) {
    super(queryResult);
    this.inner = queryResult;
  }

  public _getQueryResult(): QueryResult {
    return this.inner;
  }

  public getData(): DataArray {
    return new DataArray(this.inner.result, this.getResultExplore());
  }
}

export class DataArray {
  private queryData: QueryData;
  protected field: Explore;

  constructor(queryData: QueryData, field: Explore) {
    this.queryData = queryData;
    this.field = field;
  }

  public getField(): Explore {
    return this.field;
  }

  public toObject(): QueryData {
    return this.queryData;
  }
}

function isURLReader(
  thing: URLReader | LookupSchemaReader | LookupSQLRunner
): thing is URLReader {
  return "readURL" in thing;
}

function isLookupSchemaReader(
  thing: URLReader | LookupSchemaReader | LookupSQLRunner
): thing is LookupSchemaReader {
  return "lookupSchemaReader" in thing;
}

function isLookupSQLRunner(
  thing: URLReader | LookupSchemaReader | LookupSQLRunner
): thing is LookupSQLRunner {
  return "lookupSQLRunner" in thing;
}
