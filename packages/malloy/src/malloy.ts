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
import {
  DocumentHighlight as DocumentHighlightDefinition,
  DocumentSymbol as DocumentSymbolDefinition,
  LogMessage,
  MalloyTranslator,
} from "./lang";
import {
  CompiledQuery,
  FieldTypeDef,
  FilterExpression,
  ModelDef,
  Query as InternalQuery,
  QueryData,
  QueryDataRow,
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

async function getURLAndContents(urlReader: URLReader, source: URL | string) {
  if (source instanceof URL) {
    const contents = await urlReader.readURL(source);
    return { contents, url: source };
  } else {
    return {
      contents: source,
      url: URL.fromString("internal://internal.malloy"),
    };
  }
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

  public static parse(source: string, url?: URL): Parse {
    if (url === undefined) {
      url = URL.fromString("internal://internal.malloy");
    }
    const translator = new MalloyTranslator(url.toString(), {
      urls: { [url.toString()]: source },
    });
    return new Parse(translator);
  }

  public static async compile(
    urlReader: URLReader,
    lookupSchemaReader: LookupSchemaReader,
    parse: Parse,
    model?: Model
  ): Promise<Model> {
    const translator = parse._getTranslator();
    translator.translate(model?._getModelDef());
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = translator.translate();
      if (result.final) {
        if (result.translated) {
          return new Model(
            result.translated.modelDef,
            result.translated.queryList
          );
        } else {
          const errors = result.errors || [];
          throw new MalloyError(
            `Error(s) compiling model: ${errors[0]?.message}.`,
            errors
          );
        }
      } else if (result.urls) {
        for (const neededUrl of result.urls) {
          if (neededUrl.startsWith("internal://")) {
            throw new Error(
              "In order to use relative imports, you must compile a file via a URL."
            );
          }
          const neededText = await urlReader.readURL(URL.fromString(neededUrl));
          const urls = { [neededUrl]: neededText };
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
          const schemaFetcher = await lookupSchemaReader.lookupSchemaReader(
            connectionName
          );
          const tables = await schemaFetcher.fetchSchemaForTables(tableNames);
          translator.update({ tables });
        }
      }
    }
  }

  public static async run(
    lookupSQLRunner: LookupSQLRunner,
    preparedResult: PreparedResult
  ): Promise<Result> {
    const sqlRunner = await lookupSQLRunner.lookupSQLRunner(
      preparedResult.getConnectionName()
    );
    const result = await sqlRunner.runSQL(preparedResult.getSQL());
    return new Result({
      ...preparedResult._getRawQuery(),
      result: result.rows,
      totalRows: result.totalRows,
    });
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

export class Parse {
  translator: MalloyTranslator;

  constructor(translator: MalloyTranslator) {
    this.translator = translator;
  }

  getHighlights(): DocumentHighlight[] {
    return (this.translator.metadata().highlights || []).map(
      (highlight) => new DocumentHighlight(highlight)
    );
  }

  getSymbols(): DocumentSymbol[] {
    return (this.translator.metadata().symbols || []).map(
      (symbol) => new DocumentSymbol(symbol)
    );
  }

  _getTranslator(): MalloyTranslator {
    return this.translator;
  }
}

export class DocumentHighlight {
  private range: DocumentRange;
  private type: string;

  constructor(documentHighlight: DocumentHighlightDefinition) {
    this.range = new DocumentRange(
      new DocumentPosition(
        documentHighlight.range.start.line,
        documentHighlight.range.start.character
      ),
      new DocumentPosition(
        documentHighlight.range.end.line,
        documentHighlight.range.end.character
      )
    );
    this.type = documentHighlight.type;
  }

  getRange(): DocumentRange {
    return this.range;
  }

  getType(): string {
    return this.type;
  }
}

export class DocumentRange {
  private start: DocumentPosition;
  private end: DocumentPosition;

  constructor(start: DocumentPosition, end: DocumentPosition) {
    this.start = start;
    this.end = end;
  }

  public getStart(): DocumentPosition {
    return this.start;
  }

  public getEnd(): DocumentPosition {
    return this.end;
  }

  toJSON(): {
    start: { line: number; character: number };
    end: { line: number; character: number };
  } {
    return {
      start: this.start.toJSON(),
      end: this.end.toJSON(),
    };
  }
}

export class DocumentPosition {
  private line: number;
  private character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  getLine(): number {
    return this.line;
  }

  getCharacter(): number {
    return this.character;
  }

  toJSON(): { line: number; character: number } {
    return { line: this.line, character: this.character };
  }
}

export class DocumentSymbol {
  private range: DocumentRange;
  private type: string;
  private name: string;
  private children: DocumentSymbol[];

  constructor(documentSymbol: DocumentSymbolDefinition) {
    this.range = new DocumentRange(
      new DocumentPosition(
        documentSymbol.range.start.line,
        documentSymbol.range.start.character
      ),
      new DocumentPosition(
        documentSymbol.range.end.line,
        documentSymbol.range.end.character
      )
    );
    this.type = documentSymbol.type;
    this.name = documentSymbol.name;
    this.children = documentSymbol.children.map(
      (child) => new DocumentSymbol(child)
    );
  }

  getRange(): DocumentRange {
    return this.range;
  }

  getType(): string {
    return this.type;
  }

  getName(): string {
    return this.name;
  }

  getChildren(): DocumentSymbol[] {
    return this.children;
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

class Entity {
  private readonly name: string;
  private readonly parent?: Explore;
  private readonly source?: Entity;

  constructor(name: string, parent?: Explore, source?: Entity) {
    this.name = name;
    this.parent = parent;
    this.source = source;
  }

  public getName(): string {
    return this.name;
  }

  public getSourceClasses(): string[] {
    const sourceClasses = [];
    if (this.source) {
      sourceClasses.push(this.source.getName());
    }
    sourceClasses.push(this.getName());
    return sourceClasses;
  }

  public hasParentExplore(): boolean {
    return this.parent !== undefined;
  }

  isExplore(): this is Explore {
    return this instanceof Explore;
  }

  isQuery(): this is Query {
    return this instanceof QueryField;
  }
}

export type Field = AtomicField | QueryField | ExploreField;

export class Explore extends Entity {
  protected readonly structDef: StructDef;
  protected readonly parentExplore?: Explore;
  private fields: Map<string, Field> | undefined;

  public getName(): string {
    return this.structDef.as || this.structDef.name;
  }

  constructor(structDef: StructDef, parentExplore?: Explore, source?: Explore) {
    super(structDef.as || structDef.name, parentExplore, source);
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

  public getSourceField(): Field {
    throw new Error();
  }

  public getSourceClasses(): string[] {
    const sourceField = this.fieldTypeDef.name || this.fieldTypeDef.as;
    return sourceField ? [sourceField] : [];
  }

  public hasParentExplore(): this is Field {
    return true;
  }

  public isDimensional(): boolean {
    return true;
  }

  public isMeasurelike(): false {
    return false;
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

  public isDimensional(): false {
    return false;
  }

  public isMeasurelike(): true {
    return true;
  }

  public getSourceClasses(): string[] {
    const sourceField = this.turtleDef.name || this.turtleDef.as;
    return sourceField ? [sourceField] : [];
  }

  public hasParentExplore(): this is Field {
    return true;
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

  public getSourceClasses(): string[] {
    const sourceField = this.structDef.name || this.structDef.as;
    return sourceField ? [sourceField] : [];
  }
}

export class Runtime {
  private urlReader: URLReader;
  private lookupSchemaReader: LookupSchemaReader;
  private lookupSQLRunner: LookupSQLRunner;

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
    this.urlReader = urlReader;
    this.lookupSQLRunner = lookupSQLRunner;
    this.lookupSchemaReader = lookupSchemaReader;
  }

  public getURLReader(): URLReader {
    return this.urlReader;
  }

  public getLookupSQLRunner(): LookupSQLRunner {
    return this.lookupSQLRunner;
  }

  public getLookupSchemaReader(): LookupSchemaReader {
    return this.lookupSchemaReader;
  }

  public loadModel(source: ModelURL | ModelString): ModelMaterializer {
    return new ModelMaterializer(this, async () => {
      const { url, contents } = await getURLAndContents(this.urlReader, source);
      const parsed = Malloy.parse(contents, url);
      return Malloy.compile(this.urlReader, this.lookupSchemaReader, parsed);
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
      const urlReader = this.runtime.getURLReader();
      const lookupSchemaReader = this.runtime.getLookupSchemaReader();
      const { url, contents } = await getURLAndContents(urlReader, query);
      const parsed = Malloy.parse(contents, url);
      const model = await this.getModel();
      const queryModel = await Malloy.compile(
        urlReader,
        lookupSchemaReader,
        parsed,
        model
      );
      return queryModel.getPreparedQuery();
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
    const lookupSQLRunner = this.runtime.getLookupSQLRunner();
    const preparedResult = await this.getPreparedResult();
    return Malloy.run(lookupSQLRunner, preparedResult);
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
    const preparedResult = await this.getPreparedResult();
    return Malloy.run(this.runtime.getLookupSQLRunner(), preparedResult);
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

export type DataColumn =
  | DataArray
  | DataRecord
  | DataString
  | DataBoolean
  | DataNumber
  | DataDate
  | DataTimestamp
  | DataNull
  | DataBytes;

abstract class Data<T> {
  protected field: Field | Explore;

  constructor(field: Field | Explore) {
    this.field = field;
  }

  getField(): Field | Explore {
    return this.field;
  }

  abstract getValue(): T;

  isString(): this is DataString {
    return this instanceof DataString;
  }

  asString(): DataString {
    if (this.isString()) {
      return this;
    }
    throw new Error("Not a string.");
  }

  isBoolean(): this is DataBoolean {
    return this instanceof DataBoolean;
  }

  asBoolean(): DataBoolean {
    if (this.isBoolean()) {
      return this;
    }
    throw new Error("Not a boolean.");
  }

  isNumber(): this is DataNumber {
    return this instanceof DataNumber;
  }

  asNumber(): DataNumber {
    if (this.isNumber()) {
      return this;
    }
    throw new Error("Not a number.");
  }

  isTimestamp(): this is DataTimestamp {
    return this instanceof DataTimestamp;
  }

  asTimestamp(): DataTimestamp {
    if (this.isTimestamp()) {
      return this;
    }
    throw new Error("Not a timestamp.");
  }

  isDate(): this is DataDate {
    return this instanceof DataDate;
  }

  asDate(): DataDate {
    if (this.isDate()) {
      return this;
    }
    throw new Error("Not a date.");
  }

  isNull(): this is DataNull {
    return this instanceof DataNull;
  }

  isBytes(): this is DataBytes {
    return this instanceof DataBytes;
  }

  asBytes(): DataBytes {
    if (this.isBytes()) {
      return this;
    }
    throw new Error("Not bytes.");
  }

  isRecord(): this is DataRecord {
    return this instanceof DataRecord;
  }

  asRecord(): DataRecord {
    if (this.isRecord()) {
      return this;
    }
    throw new Error("Not a record.");
  }

  isArray(): this is DataArray {
    return this instanceof DataArray;
  }

  asArray(): DataArray {
    if (this.isArray()) {
      return this;
    }
    throw new Error("Not an array.");
  }
}

class ScalarData<T> extends Data<T> {
  private value: T;
  protected field: AtomicField;

  constructor(value: T, field: AtomicField) {
    super(field);
    this.value = value;
    this.field = field;
  }

  getValue(): T {
    return this.value;
  }
}

class DataString extends ScalarData<string> {}
class DataBoolean extends ScalarData<boolean> {}
class DataNumber extends ScalarData<number> {}
class DataTimestamp extends ScalarData<Date> {}
class DataDate extends ScalarData<Date> {}
class DataBytes extends ScalarData<Buffer> {}

class DataNull extends Data<null> {
  getValue(): null {
    return null;
  }
}

export class DataArray extends Data<DataColumn[]> {
  private queryData: QueryData;
  protected field: Explore;

  constructor(queryData: QueryData, field: Explore) {
    super(field);
    this.queryData = queryData;
    this.field = field;
  }

  public getField(): Explore {
    return this.field;
  }

  public toObject(): QueryData {
    return this.queryData;
  }

  getRowByIndex(index: number): DataRecord {
    return new DataRecord(this.queryData[index], this.field);
  }

  getValue(): DataColumn[] {
    throw new Error("Not implemented;");
  }
}

class DataRecord extends Data<{ [fieldName: string]: DataColumn }> {
  private queryDataRow: QueryDataRow;
  protected field: Explore;

  constructor(queryDataRow: QueryDataRow, field: Explore) {
    super(field);
    this.queryDataRow = queryDataRow;
    this.field = field;
  }

  toObject(): QueryDataRow {
    return this.queryDataRow;
  }

  getColumn(fieldName: string): DataColumn {
    const field = this.field.getFieldByName(fieldName);
    const value = this.queryDataRow[fieldName];
    if (value === null) {
      return new DataNull(field);
    }
    if (field.isAtomicField()) {
      switch (field.getType()) {
        case AtomicFieldType.Boolean:
          return new DataBoolean(value as boolean, field);
        case AtomicFieldType.Date:
          return new DataDate(value as Date, field);
        case AtomicFieldType.Timestamp:
          return new DataTimestamp(value as Date, field);
        case AtomicFieldType.Number:
          return new DataNumber(value as number, field);
        case AtomicFieldType.String:
          return new DataString(value as string, field);
      }
    } else if (field.isExploreField()) {
      if (value instanceof Array) {
        return new DataArray(value, field);
      } else {
        return new DataRecord(value as QueryDataRow, field);
      }
    }
    // TODO crs
    throw new Error("Oops");
  }

  getValue(): { [fieldName: string]: DataColumn } {
    throw new Error("Not implemented;");
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
