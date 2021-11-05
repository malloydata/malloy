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
  // TODO load from file built durlng release
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

  public async makeModel(model: ModelString | ModelUrl | Model): Promise<Model>;
  public async makeModel(
    model: ModelString | ModelUrl | Model,
    query: QueryString | QueryUrl
  ): Promise<Model>;
  public async makeModel(
    primaryOrBase: ModelString | ModelUrl | Model,
    maybePrimary?: ModelString | ModelUrl | QueryString | QueryUrl
  ): Promise<Model> {
    const { primary, base } = flipPrimaryBase(primaryOrBase, maybePrimary);
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

  getSql(): string {
    return this.inner.sql;
  }

  getResultExplore(): Explore {
    const lastStageName = this.inner.lastStageName;
    const explore = this.inner.structs.find(
      (explore) => explore.name === lastStageName
    );
    if (explore === undefined) {
      throw new Error("Malformed query result.");
    }
    const namedExplore = {
      ...explore,
      name: this.inner.queryName || explore.name,
    };
    return new Explore(namedExplore);
  }

  _getSourceExploreName(): string {
    return this.inner.sourceExplore;
  }

  _getSourceFilters(): FilterExpression[] {
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

  async readUrl(url: Url): Promise<string> {
    const file = this.files.get(url.toString());
    if (file !== undefined) {
      return Promise.resolve(file);
    } else {
      throw new Error(`File not found '${url}'`);
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

export enum SourceRelationship {
  Nested = "nested",
  Condition = "condition",
  BaseTable = "base_table",
  ForeignKey = "foreign_key",
  Inline = "inline",
}

// TODO maybe generalize this as leftOptional?
function flipPrimaryBase(
  primaryOrBase: ModelString | ModelUrl | Model,
  maybePrimary?: ModelString | ModelUrl | QueryString | QueryUrl
) {
  let primary: ModelString | ModelUrl | QueryString | QueryUrl;
  let base: ModelString | ModelUrl | Model | undefined;
  if (maybePrimary === undefined) {
    if (primaryOrBase instanceof Model) {
      // TODO crs
      throw new Error("Oops");
    }
    primary = primaryOrBase;
  } else {
    primary = maybePrimary;
    base = primaryOrBase;
  }
  return { primary, base };
}

export type Field = AtomicField | QueryField | ExploreField;

export class Explore {
  protected readonly structDef: StructDef;
  protected readonly parentExplore?: Explore;
  private fields: Map<string, Field> | undefined;

  getName(): string {
    return this.structDef.as || this.structDef.name;
  }

  constructor(structDef: StructDef, parentExplore?: Explore) {
    this.structDef = structDef;
    this.parentExplore = parentExplore;
  }

  public _getStructDef(): StructDef {
    return this.structDef;
  }

  getQueryByName(name: string): PreparedQuery {
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

  getSingleExploreModel(): Model {
    return new Model(this.getModelDef(), []);
  }

  getFieldMap(): Map<string, Field> {
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

  getFields(): Field[] {
    return [...this.getFieldMap().values()];
  }

  getFieldByName(fieldName: string): Field {
    const field = this.getFieldMap().get(fieldName);
    if (field === undefined) {
      throw new Error(`No such field ${fieldName}.`);
    }
    return field;
  }

  getPrimaryKey(): string | undefined {
    return this.structDef.primaryKey;
  }

  getParentExplore(): Explore | undefined {
    return this.parentExplore;
  }

  getSourceRelationship(): SourceRelationship {
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

  hasParentExplore(): this is ExploreField {
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

  getName(): string {
    return this.fieldTypeDef.as || this.fieldTypeDef.name;
  }

  getType(): AtomicFieldType {
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

  isQueryField(): this is QueryField {
    return false;
  }

  isExploreField(): this is ExploreField {
    return false;
  }

  isAtomicField(): this is AtomicField {
    return true;
  }

  isAggregate(): boolean {
    return !!this.fieldTypeDef.aggregate;
  }
}

export class QueryField {
  private turtleDef: TurtleDef;

  constructor(turtleDef: TurtleDef) {
    this.turtleDef = turtleDef;
  }

  getName(): string {
    return this.turtleDef.as || this.turtleDef.name;
  }

  isQueryField(): this is QueryField {
    return true;
  }

  isExploreField(): this is ExploreField {
    return false;
  }

  isAtomicField(): this is AtomicField {
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

  getJoinRelationship(): JoinRelationship {
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

  isQueryField(): this is QueryField {
    return false;
  }

  isExploreField(): this is ExploreField {
    return true;
  }

  isAtomicField(): this is AtomicField {
    return false;
  }

  getParentExplore(): Explore {
    return this.parentExplore;
  }
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

  makeModel(source: ModelUrl | ModelString): ModelRuntimeRequest {
    const compiler = this.getCompiler();
    return new ModelRuntimeRequest(this, function build() {
      return compiler.makeModel(source);
    });
  }

  makeQuery(query: QueryUrl | QueryString): PreparedQueryRuntimeRequest {
    return this.makeModel(query).getQuery();
  }

  makeQueryByIndex(
    model: ModelUrl | ModelString,
    index: number
  ): PreparedQueryRuntimeRequest {
    return this.makeModel(model).getQueryByIndex(index);
  }

  makeQueryByName(
    model: ModelUrl | ModelString,
    name: string
  ): PreparedQueryRuntimeRequest {
    return this.makeModel(model).getQueryByName(name);
  }

  public getRunner(): Runner {
    return this.runner;
  }

  public getCompiler(): Compiler {
    return this.compiler;
  }
}

class RuntimeRequest<T> {
  protected runtime: Runtime;
  private readonly _build: () => Promise<T>;
  private built: Promise<T> | undefined;

  constructor(runtime: Runtime, build: () => Promise<T>) {
    this.runtime = runtime;
    this._build = build;
  }

  public build(): Promise<T> {
    if (this.built === undefined) {
      return this.rebuild();
    }
    return this.built;
  }

  public rebuild(): Promise<T> {
    this.built = this._build();
    return this.built;
  }

  protected buildQuery(
    build: () => Promise<PreparedQuery>
  ): PreparedQueryRuntimeRequest {
    return new PreparedQueryRuntimeRequest(this.runtime, build);
  }

  protected buildExplore(build: () => Promise<Explore>): ExploreRuntimeRequest {
    return new ExploreRuntimeRequest(this.runtime, build);
  }

  protected buildPreparedResult(
    build: () => Promise<PreparedResult>
  ): PreparedResultRuntimeRequest {
    return new PreparedResultRuntimeRequest(this.runtime, build);
  }
}

export class ModelRuntimeRequest extends RuntimeRequest<Model> {
  getQuery(): PreparedQueryRuntimeRequest {
    return this.buildQuery(async () => {
      return (await this.build()).getPreparedQuery();
    });
  }

  getQueryByIndex(index: number): PreparedQueryRuntimeRequest {
    return this.buildQuery(async () => {
      return (await this.build()).getPreparedQueryByIndex(index);
    });
  }

  getQueryByName(name: string): PreparedQueryRuntimeRequest {
    return this.buildQuery(async () => {
      return (await this.build()).getPreparedQueryByName(name);
    });
  }

  makeQuery(query: QueryString | QueryUrl): PreparedQueryRuntimeRequest {
    return this.buildQuery(async () => {
      const model = await this.runtime
        .getCompiler()
        .makeModel(await this.build(), query);
      return model.getPreparedQuery();
    });
  }

  getExploreByName(name: string): ExploreRuntimeRequest {
    return this.buildExplore(async () => {
      return (await this.build()).getExploreByName(name);
    });
  }
}

class PreparedQueryRuntimeRequest extends RuntimeRequest<PreparedQuery> {
  async run(): Promise<Result> {
    return this.runtime.getRunner().run(await this.getSql().build());
  }

  getSql(): PreparedResultRuntimeRequest {
    return this.buildPreparedResult(async () => {
      return (await this.build()).getPreparedResult();
    });
  }
}

class PreparedResultRuntimeRequest extends RuntimeRequest<PreparedResult> {
  async run(): Promise<Result> {
    const preparedSql = await this.build();
    return this.runtime.getRunner().run(preparedSql);
  }
}

class ExploreRuntimeRequest extends RuntimeRequest<Explore> {
  getQueryByName(name: string): PreparedQueryRuntimeRequest {
    return this.buildQuery(async () => {
      return (await this.build()).getQueryByName(name);
    });
  }
}

export class Result extends PreparedResult {
  protected inner: QueryResult;

  constructor(queryResult: QueryResult) {
    super(queryResult);
    this.inner = queryResult;
  }

  _getQueryResult(): QueryResult {
    return this.inner;
  }

  getData(): DataArray {
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

  getField(): Explore {
    return this.field;
  }

  toObject(): QueryData {
    return this.queryData;
  }
}
