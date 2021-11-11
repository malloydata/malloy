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
  LookupSqlRunner,
  LookupSchemaReader,
  ModelString,
  ModelUrl,
  SqlRunner,
  QueryString,
  QueryUrl,
  Url,
  UrlReader,
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
  private urlReader: UrlReader;
  private lookupSchemaReader: LookupSchemaReader;

  constructor(urlReader: UrlReader, lookupSchemaReader: LookupSchemaReader) {
    this.urlReader = urlReader;
    this.lookupSchemaReader = lookupSchemaReader;
  }

  private async _compile(
    url: Url,
    malloy: string,
    model?: ModelDef
  ): Promise<{ modelDef: ModelDef; queryList: InternalQuery[] }> {
    const translator = new MalloyTranslator(url.toString(), {
      URLs: { [url.toString()]: malloy },
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
      } else if (result.URLs) {
        for (const neededUrl of result.URLs) {
          if (neededUrl.startsWith("internal://")) {
            throw new Error(
              "In order to use relative imports, you must compile a file via a URL."
            );
          }
          const neededText = await this.urlReader.readUrl(
            Url.fromString(neededUrl)
          );
          const URLs = { [neededUrl]: neededText };
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

  private async toUrlAndContents(source: Url | string) {
    if (source instanceof Url) {
      const contents = await this.urlReader.readUrl(source);
      return { contents, url: source };
    } else {
      return {
        contents: source,
        url: Url.fromString("internal://internal.malloy"),
      };
    }
  }

  public async makeModel(model: ModelString | ModelUrl): Promise<Model>;
  public async makeModel(
    model: ModelString | ModelUrl | Model,
    query: QueryString | QueryUrl
  ): Promise<Model>;
  public async makeModel(
    primaryOrBase: ModelString | ModelUrl | Model,
    maybePrimary?: ModelString | ModelUrl | QueryString | QueryUrl
  ): Promise<Model> {
    let primary: ModelString | ModelUrl | QueryString | QueryUrl;
    let base: ModelString | ModelUrl | Model | undefined;
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
        const { url, contents } = await this.toUrlAndContents(base);
        model = (await this._compile(url, contents)).modelDef;
      }
    }

    const { url, contents } = await this.toUrlAndContents(primary);
    const { modelDef, queryList } = await this._compile(url, contents, model);
    return new Model(modelDef, queryList);
  }
}

export class Runner {
  private lookupSqlRunner: LookupSqlRunner;

  constructor(lookupSqlRunner: LookupSqlRunner) {
    this.lookupSqlRunner = lookupSqlRunner;
  }

  public async run(
    preparedSql: PreparedResult | Promise<PreparedResult>
  ): Promise<Result> {
    preparedSql = await preparedSql;
    const sqlRunner = await this.getSqlRunner(preparedSql.getConnectionName());
    return Runner.run(sqlRunner, preparedSql);
  }

  public getSqlRunner(connectionName: string): Promise<SqlRunner> {
    return this.lookupSqlRunner.lookupQueryRunner(connectionName);
  }

  public static async run(
    sqlRunner: SqlRunner,
    preparedSql: PreparedResult | Promise<PreparedResult>
  ): Promise<Result> {
    preparedSql = await preparedSql;
    const result = await sqlRunner.runSql(preparedSql.getSql());
    return new Result({
      ...preparedSql._getRawQuery(),
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

  public getSql(): string {
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

export class EmptyUrlReader implements UrlReader {
  async readUrl(_url: Url): Promise<string> {
    throw new Error("No files.");
  }
}

export class InMemoryUrlReader implements UrlReader {
  private files: Map<string, string>;

  constructor(files: Map<string, string>) {
    this.files = files;
  }

  public async readUrl(url: Url): Promise<string> {
    const file = this.files.get(url.toString());
    if (file !== undefined) {
      return Promise.resolve(file);
    } else {
      throw new Error(`File not found '${url}'`);
    }
  }
}

export class FixedConnectionMap implements LookupSchemaReader, LookupSqlRunner {
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

  public async lookupQueryRunner(connectionName?: string): Promise<Connection> {
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

interface Materializer<T> {
  materialize(): Promise<T>;
}

export class Runtime {
  private compiler: Compiler;
  private runner: Runner;

  constructor({
    urls,
    schemas,
    connections,
  }: {
    urls: UrlReader;
    schemas: LookupSchemaReader;
    connections: LookupSqlRunner;
  }) {
    this.compiler = new Compiler(urls, schemas);
    this.runner = new Runner(connections);
  }

  public createModelMaterializer(
    source: ModelUrl | ModelString
  ): RuntimeModelMaterializer {
    const compiler = this.getCompiler();
    return new RuntimeModelMaterializer(this, function materialize() {
      return compiler.makeModel(source);
    });
  }

  // TODO Consider formalizing this. Perhaps as a `withModel` method,
  //      as well as a `Model.fromModelDefinition` if we choose to expose
  //      `ModelDef` to the world formally. For now, this should only
  //      be used in tests.
  public _makeModelFromModelDef(modelDef: ModelDef): RuntimeModelMaterializer {
    return new RuntimeModelMaterializer(this, async function materialize() {
      return new Model(modelDef, []);
    });
  }

  public createQueryMaterializer(
    query: QueryUrl | QueryString
  ): RuntimeQueryMaterializer {
    return this.createModelMaterializer(query).getQueryMaterializer();
  }

  public createQueryMaterializerByIndex(
    model: ModelUrl | ModelString,
    index: number
  ): RuntimeQueryMaterializer {
    return this.createModelMaterializer(model).getQueryMaterializerByIndex(
      index
    );
  }

  public createQueryMaterializerByName(
    model: ModelUrl | ModelString,
    name: string
  ): RuntimeQueryMaterializer {
    return this.createModelMaterializer(model).getQueryMaterializerByName(name);
  }

  public getRunner(): Runner {
    return this.runner;
  }

  public getCompiler(): Compiler {
    return this.compiler;
  }
}

class RuntimeMaterializer<T> implements Materializer<T> {
  protected runtime: Runtime;
  private readonly _materialize: () => Promise<T>;
  private materialized: Promise<T> | undefined;

  constructor(runtime: Runtime, materialize: () => Promise<T>) {
    this.runtime = runtime;
    this._materialize = materialize;
  }

  public materialize(): Promise<T> {
    if (this.materialized === undefined) {
      return this.rematerialize();
    }
    return this.materialized;
  }

  public rematerialize(): Promise<T> {
    this.materialized = this._materialize();
    return this.materialized;
  }

  protected makeQueryMaterializer(
    materialize: () => Promise<PreparedQuery>
  ): RuntimeQueryMaterializer {
    return new RuntimeQueryMaterializer(this.runtime, materialize);
  }

  protected makeExploreMaterializer(
    materialize: () => Promise<Explore>
  ): RuntimeExploreMaterializer {
    return new RuntimeExploreMaterializer(this.runtime, materialize);
  }

  protected makePreparedResultMaterializer(
    materialize: () => Promise<PreparedResult>
  ): RuntimePreparedResultMaterializer {
    return new RuntimePreparedResultMaterializer(this.runtime, materialize);
  }
}

export class RuntimeModelMaterializer extends RuntimeMaterializer<Model> {
  public getQueryMaterializer(): RuntimeQueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQuery();
    });
  }

  public getQueryMaterializerByIndex(index: number): RuntimeQueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQueryByIndex(index);
    });
  }

  public getQueryMaterializerByName(name: string): RuntimeQueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQueryByName(name);
    });
  }

  public createQueryMaterializer(
    query: QueryString | QueryUrl
  ): RuntimeQueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      const model = await this.runtime
        .getCompiler()
        .makeModel(await this.materialize(), query);
      return model.getPreparedQuery();
    });
  }

  // TODO Consider formalizing this. Perhaps as a `withQuery` method,
  //      as well as a `PreparedQuery.fromQueryDefinition` if we choose to expose
  //      `InternalQuery` to the world formally. For now, this should only
  //      be used in tests.
  public _makeQueryFromQueryDef(
    query: InternalQuery
  ): RuntimeQueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      const model = await this.materialize();
      return new PreparedQuery(query, model._getModelDef());
    });
  }

  public getExploreMaterializerByName(
    name: string
  ): RuntimeExploreMaterializer {
    return this.makeExploreMaterializer(async () => {
      return (await this.materialize()).getExploreByName(name);
    });
  }
}

class RuntimeQueryMaterializer extends RuntimeMaterializer<PreparedQuery> {
  async run(): Promise<Result> {
    return this.runtime
      .getRunner()
      .run(await this.getPreparedResultMaterializer().materialize());
  }

  public getPreparedResultMaterializer(): RuntimePreparedResultMaterializer {
    return this.makePreparedResultMaterializer(async () => {
      return (await this.materialize()).getPreparedResult();
    });
  }
}

class RuntimePreparedResultMaterializer extends RuntimeMaterializer<PreparedResult> {
  async run(): Promise<Result> {
    const preparedSql = await this.materialize();
    return this.runtime.getRunner().run(preparedSql);
  }
}

class RuntimeExploreMaterializer extends RuntimeMaterializer<Explore> {
  getQueryMaterializerByName(name: string): RuntimeQueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getQueryByName(name);
    });
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
