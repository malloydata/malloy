/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {RunSQLOptions} from './run_sql_options';
import {
  DocumentCompletion as DocumentCompletionDefinition,
  DocumentHighlight as DocumentHighlightDefinition,
  DocumentSymbol as DocumentSymbolDefinition,
  LogMessage,
  MalloyTranslator,
} from './lang';
import {DocumentHelpContext} from './lang/parse-tree-walkers/document-help-context-walker';
import {
  CompiledQuery,
  DocumentReference,
  FieldBooleanDef,
  FieldDateDef,
  FieldIsIntrinsic,
  FieldJSONDef,
  FieldNumberDef,
  FieldStringDef,
  FieldTimestampDef,
  FieldTypeDef,
  FilterExpression,
  Query as InternalQuery,
  ModelDef,
  DocumentPosition as ModelDocumentPosition,
  NamedQuery,
  QueryData,
  QueryDataRow,
  QueryModel,
  QueryResult,
  SQLBlock,
  SQLBlockSource,
  SQLBlockStructDef,
  SearchIndexResult,
  SearchValueMapResult,
  StructDef,
  TurtleDef,
  expressionIsCalculation,
  flattenQuery,
  isSQLBlockStruct,
  isSQLFragment,
  FieldUnsupportedDef,
  QueryRunStats,
} from './model';
import {
  Connection,
  InfoConnection,
  LookupConnection,
  ModelString,
  ModelURL,
  QueryString,
  QueryURL,
  URLReader,
} from './runtime_types';
import {DateTime} from 'luxon';
import {Taggable, Tags} from './tags';

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
    return '0.0.1';
  }

  private static _log: Loggable;

  public static get log(): Loggable {
    return Malloy._log || console;
  }

  public static setLogger(log: Loggable): void {
    Malloy._log = log;
  }

  private static _parse(source: string, url?: URL): Parse {
    if (url === undefined) {
      url = new URL('internal://internal.malloy');
    }
    const translator = new MalloyTranslator(url.toString(), {
      urls: {[url.toString()]: source},
    });
    return new Parse(translator);
  }

  /**
   * Parse a Malloy document by URL.
   *
   * @param url The URL of the Malloy document to parse.
   * @param urlReader Object capable of fetching URL contents.
   * @return A (promise of a) `Parse` result.
   */
  public static parse({
    url,
    urlReader,
  }: {
    url: URL;
    urlReader: URLReader;
  }): Promise<Parse>;
  /**
   * Parse a Malloy document by contents.
   *
   * @param url The URL of the Malloy document to parse (optional).
   * @param source The contents of the Malloy document to parse.
   * @return A `Parse` result.
   */
  public static parse({source, url}: {url?: URL; source: string}): Parse;
  public static parse({
    url,
    urlReader,
    source,
  }: {
    url?: URL;
    source?: string;
    urlReader?: URLReader;
  }): Parse | Promise<Parse> {
    if (source !== undefined) {
      return Malloy._parse(source, url);
    } else {
      if (urlReader === undefined) {
        throw new Error('Internal Error: urlReader is required.');
      }
      if (url === undefined) {
        throw new Error(
          'Internal Error: url is required if source not present.'
        );
      }
      return urlReader.readURL(url).then(source => {
        return Malloy._parse(source, url);
      });
    }
  }

  /**
   * Compile a parsed Malloy document.
   *
   * @param urlReader Object capable of reading contents of a URL.
   * @param connections Mapping of connection names to objects capable of reading Malloy schemas.
   * @param parse The parsed Malloy document.
   * @param model A compiled model to build upon (optional).
   * @return A (promise of a) compiled `Model`.
   */
  public static async compile({
    urlReader,
    connections,
    parse,
    model,
  }: {
    urlReader: URLReader;
    connections: LookupConnection<InfoConnection>;
    parse: Parse;
    model?: Model;
  }): Promise<Model> {
    const translator = parse._translator;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = translator.translate(model?._modelDef);
      if (result.final) {
        if (result.translated) {
          return new Model(
            result.translated.modelDef,
            result.translated.queryList,
            result.translated.sqlBlocks,
            result.problems || [],
            (position: ModelDocumentPosition) =>
              translator.referenceAt(position)
          );
        } else {
          const errors = result.problems || [];
          const errText = translator.prettyErrors();
          throw new MalloyError(
            `Error(s) compiling model:\n${errText}`,
            errors
          );
        }
      } else {
        // Parse incomplete because some external information is required,
        // there might be more than one of these in a single reply ...
        if (result.urls) {
          for (const neededUrl of result.urls) {
            try {
              if (neededUrl.startsWith('internal://')) {
                throw new Error(
                  'In order to use relative imports, you must compile a file via a URL.'
                );
              }
              const neededText = await urlReader.readURL(new URL(neededUrl));
              const urls = {[neededUrl]: neededText};
              translator.update({urls});
            } catch (error) {
              translator.update({
                errors: {urls: {[neededUrl]: error.message}},
              });
            }
          }
        }
        if (result.tables) {
          // collect tables by connection name since there may be multiple connections
          const tablesByConnection: Map<
            string | undefined,
            Record<string, string>
          > = new Map();
          for (const tableKey in result.tables) {
            const {connectionName, tablePath} = result.tables[tableKey];

            const connectionToTablesMap =
              tablesByConnection.get(connectionName);
            if (connectionToTablesMap === undefined) {
              tablesByConnection.set(connectionName, {[tableKey]: tablePath});
            } else {
              connectionToTablesMap[tableKey] = tablePath;
            }
          }
          // iterate over connections, fetching schema for all missing tables
          for (const [connectionName, tablePathByKey] of tablesByConnection) {
            try {
              const connection = await connections.lookupConnection(
                connectionName
              );
              // TODO detect if the union of `Object.keys(tables)` and `Object.keys(errors)` is not the same
              //      as `Object.keys(tablePathByKey)`, i.e. that all tables are accounted for. Otherwise
              //      the translator runs into an infinite loop fetching tables.
              const {schemas: tables, errors} =
                await connection.fetchSchemaForTables(tablePathByKey);
              translator.update({tables, errors: {tables: errors}});
            } catch (error) {
              // There was an exception getting the connection, associate that error
              // with all its tables
              const tables = {};
              const errors: {[name: string]: string} = {};
              for (const tableKey in tablePathByKey) {
                errors[tableKey] = error.toString();
              }
              translator.update({tables, errors: {tables: errors}});
            }
          }
        }
        if (result.compileSQL) {
          // Unlike other requests, these do not come in batches
          const toCompile = result.compileSQL;
          const connectionName = toCompile.connection;
          try {
            const conn = await connections.lookupConnection(connectionName);
            const expanded = Malloy.compileSQLBlock(
              result.partialModel,
              toCompile
            );
            const resolved = await conn.fetchSchemaForSQLBlock(expanded);
            if (resolved.error) {
              translator.update({
                errors: {compileSQL: {[expanded.name]: resolved.error}},
              });
            }
            if (resolved.structDef) {
              if (isSQLBlockStruct(resolved.structDef)) {
                translator.update({
                  compileSQL: {[expanded.name]: resolved.structDef},
                });
              }
            }
          } catch (error) {
            const errors: {[name: string]: string} = {};
            errors[toCompile.name] = error.toString();
            translator.update({errors: {compileSQL: errors}});
          }
        }
      }
    }
  }

  private static compileSQLBlock(
    partialModel: ModelDef | undefined,
    toCompile: SQLBlockSource
  ): SQLBlock {
    let queryModel: QueryModel;
    const sqlStrings = toCompile.select.map(segment => {
      if (isSQLFragment(segment)) {
        return segment.sql;
      } else {
        // TODO catch exceptions and throw errors ...
        if (!queryModel) {
          if (!partialModel) {
            throw new Error(
              'Internal error: Partial model missing when compiling SQL block'
            );
          }
          queryModel = new QueryModel(partialModel);
        }
        return queryModel.compileQuery(segment, false).sql;
      }
    });
    const {name, connection} = toCompile;
    return {
      type: 'sqlBlock',
      name,
      connection,
      selectStr: sqlStrings.join(''),
    };
  }

  /**
   * Run a fully-prepared query.
   *
   * @param get A mapping from connection names to objects capable of running SQL.
   * @param preparedResult A fully-prepared query which is ready to run (a `PreparedResult`).
   * @return Query result data and associated metadata.
   */
  public static async run(params: {
    connections: LookupConnection<Connection>;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connection: Connection;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connection: Connection;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connection: Connection;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): Promise<Result>;
  public static async run({
    connections,
    preparedResult,
    sqlStruct,
    connection,
    options,
  }: {
    connection?: Connection;
    preparedResult?: PreparedResult;
    sqlStruct?: SQLBlockStructDef;
    connections?: LookupConnection<Connection>;
    options?: RunSQLOptions;
  }): Promise<Result> {
    const sqlBlock = sqlStruct?.structSource.sqlBlock;
    if (!connection) {
      if (!connections) {
        throw new Error(
          'Internal Error: Connection or LookupConnection<Connection> must be provided.'
        );
      }
      const connectionName =
        sqlBlock?.connection || preparedResult?.connectionName;
      connection = await connections.lookupConnection(connectionName);
    }
    if (sqlStruct && sqlBlock) {
      if (sqlStruct.structRelationship.type !== 'basetable') {
        throw new Error(
          "Expected schema's structRelationship type to be 'basetable'."
        );
      }
      const data = await connection.runSQL(sqlBlock.selectStr);
      return new Result(
        {
          structs: [sqlStruct],
          sql: sqlBlock.selectStr,
          result: data.rows,
          totalRows: data.totalRows,
          runStats: data.runStats,
          lastStageName: sqlBlock.name,
          // TODO feature-sql-block There is no malloy code...
          malloy: '',
          connectionName: sqlStruct.structRelationship.connectionName,
          // TODO feature-sql-block There is no source explore...
          sourceExplore: '',
          sourceFilters: [],
        },
        {
          name: 'empty_model',
          exports: [],
          contents: {},
        }
      );
    } else if (preparedResult) {
      const result = await connection.runSQL(preparedResult.sql, options);
      return new Result(
        {
          ...preparedResult._rawQuery,
          result: result.rows,
          totalRows: result.totalRows,
          runStats: result.runStats,
        },
        preparedResult._modelDef
      );
    } else {
      throw new Error(
        'Internal error: sqlStruct or preparedResult must be provided.'
      );
    }
  }

  public static runStream(params: {
    connections: LookupConnection<Connection>;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connection: Connection;
    preparedResult: PreparedResult;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connection: Connection;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connections: LookupConnection<Connection>;
    sqlBlock: SQLBlock;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connection: Connection;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static runStream(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLBlockStructDef;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord>;
  public static async *runStream({
    connections,
    preparedResult,
    sqlStruct,
    connection,
    options,
  }: {
    connection?: Connection;
    preparedResult?: PreparedResult;
    sqlStruct?: SQLBlockStructDef;
    connections?: LookupConnection<Connection>;
    options?: RunSQLOptions;
  }): AsyncIterableIterator<DataRecord> {
    const sqlBlock = sqlStruct?.structSource.sqlBlock;
    if (sqlBlock === undefined && preparedResult === undefined) {
      throw new Error(
        'Internal error: sqlBlock or preparedResult must be provided.'
      );
    }
    const connectionName =
      sqlBlock?.connection || preparedResult?.connectionName;
    if (connection === undefined) {
      if (connections === undefined) {
        throw new Error(
          'Internal Error: Connection or LookupConnection<Connection> must be provided.'
        );
      }
      connection = await connections.lookupConnection(connectionName);
    }
    // TODO is there a better way to handle this case? Just require StreamingConnections?
    if (!connection.canStream()) {
      throw new Error(`Connection '${connectionName}' cannot stream results.`);
    }
    let sql;
    let resultExplore;
    if (sqlStruct) {
      if (sqlStruct.structRelationship.type !== 'basetable') {
        throw new Error(
          "Expected schema's structRelationship type to be 'basetable'."
        );
      }
      resultExplore = new Explore(sqlStruct);
      sql = sqlStruct.structSource.sqlBlock.selectStr;
    } else if (preparedResult !== undefined) {
      resultExplore = preparedResult.resultExplore;
      sql = preparedResult.sql;
    } else {
      throw new Error(
        'Internal error: sqlStruct or preparedResult must be provided.'
      );
    }
    let index = 0;
    for await (const row of connection.runSQLStream(sql, options)) {
      yield new DataRecord(row, index, resultExplore, undefined);
      index += 1;
    }
  }

  public static async estimateQueryCost(params: {
    connections: LookupConnection<Connection>;
    preparedResult: PreparedResult;
  }): Promise<QueryRunStats>;
  public static async estimateQueryCost(params: {
    connections: LookupConnection<Connection>;
    sqlStruct: SQLBlockStructDef;
  }): Promise<QueryRunStats>;
  public static async estimateQueryCost({
    connections,
    preparedResult,
    sqlStruct,
  }: {
    preparedResult?: PreparedResult;
    sqlStruct?: SQLBlockStructDef;
    connections: LookupConnection<Connection>;
  }): Promise<QueryRunStats> {
    const sqlBlock = sqlStruct?.structSource.sqlBlock;
    if (!connections) {
      throw new Error(
        'Internal Error: Connection or LookupConnection<Connection> must be provided.'
      );
    }

    const connectionName =
      sqlBlock?.connection || preparedResult?.connectionName;
    const connection = await connections.lookupConnection(connectionName);

    if (sqlBlock) {
      return await connection.estimateQueryCost(sqlBlock?.selectStr);
    } else if (preparedResult) {
      return await connection.estimateQueryCost(preparedResult?.sql);
    } else {
      throw new Error(
        'Internal error: sqlStruct or preparedResult must be provided.'
      );
    }
  }
}

/**
 * A Malloy error, which may contain log messages produced during compilation.
 */
export class MalloyError extends Error {
  /**
   * An array of log messages produced during compilation.
   */
  constructor(message: string, readonly problems: LogMessage[] = []) {
    super(message);
  }
}

/**
 * A compiled Malloy document.
 */
export class Model implements Taggable {
  private modelDef: ModelDef;
  private queryList: InternalQuery[];
  private sqlBlocks: SQLBlockStructDef[];
  _referenceAt: (
    location: ModelDocumentPosition
  ) => DocumentReference | undefined;
  readonly problems: LogMessage[];

  constructor(
    modelDef: ModelDef,
    queryList: InternalQuery[],
    sqlBlocks: SQLBlockStructDef[],
    problems: LogMessage[],
    referenceAt: (
      location: ModelDocumentPosition
    ) => DocumentReference | undefined = () => undefined
  ) {
    this.modelDef = modelDef;
    this.queryList = queryList;
    this.sqlBlocks = sqlBlocks;
    this._referenceAt = referenceAt;
    this.problems = problems;
  }

  getTags(): Tags {
    return new Tags(this.modelDef.annotation);
  }

  /**
   * Retrieve a document reference for the token at the given position within
   * the document that produced this model.
   *
   * @param position A position within the document.
   * @return A `DocumentReference` at that position if one exists.
   */
  public getReference(
    position: ModelDocumentPosition
  ): DocumentReference | undefined {
    return this._referenceAt(position);
  }

  /**
   * Retrieve a prepared query by the name of a query at the top level of the model.
   *
   * @param queryName Name of the query to retrieve.
   * @return A prepared query.
   */
  public getPreparedQueryByName(queryName: string): PreparedQuery {
    const query = this.modelDef.contents[queryName];
    if (query?.type === 'query') {
      return new PreparedQuery(query, this.modelDef, queryName);
    }

    throw new Error('Given query name does not refer to a named query.');
  }

  /**
   * Retrieve a prepared query by the index of an unnamed query at the top level of a model.
   *
   * @param index The index of the query to retrieve.
   * @return A prepared query.
   */
  public getPreparedQueryByIndex(index: number): PreparedQuery {
    if (index < 0) {
      throw new Error(`Invalid index ${index}.`);
    } else if (index >= this.queryList.length) {
      throw new Error(`Query index ${index} is out of bounds.`);
    }
    return new PreparedQuery(this.queryList[index], this.modelDef);
  }

  /**
   * Retrieve a prepared query by the name of a query at the top level of the model.
   *
   * @param queryName Name of the query to retrieve.
   * @return A prepared query.
   */
  public getSQLBlockByName(sqlBlockName: string): SQLBlockStructDef {
    const sqlBlock = this.sqlBlocks.find(
      sqlBlock => sqlBlock.as === sqlBlockName
    );
    if (sqlBlock === undefined) {
      throw new Error(`No SQL Block named '${sqlBlockName}'`);
    }
    return sqlBlock;
  }

  /**
   * Retrieve a prepared query by the name of a query at the top level of the model.
   *
   * @param index Index of the SQL Block to retrieve.
   * @return A prepared query.
   */
  public getSQLBlockByIndex(index: number): SQLBlockStructDef {
    const sqlBlock = this.sqlBlocks[index];
    if (sqlBlock === undefined) {
      throw new Error(`No SQL Block at index ${index}`);
    }
    return sqlBlock;
  }

  /**
   * Retrieve a prepared query for the final unnamed query at the top level of a model.
   *
   * @return A prepared query.
   */
  public get preparedQuery(): PreparedQuery {
    if (this.queryList.length === 0) {
      throw new Error('Model has no queries.');
    }
    return new PreparedQuery(
      this.queryList[this.queryList.length - 1],
      this.modelDef
    );
  }

  /**
   * Retrieve an `Explore` from the model by name.
   *
   * @param name The name of the `Explore` to retrieve.
   * @return An `Explore`.
   */
  public getExploreByName(name: string): Explore {
    const struct = this.modelDef.contents[name];
    if (struct.type === 'struct') {
      return new Explore(struct);
    }
    throw new Error("'name' is not an explore");
  }

  /**
   * Get an array of `Explore`s contained in the model.
   *
   * @return An array of `Explore`s contained in the model.
   */
  public get explores(): Explore[] {
    const explores: Explore[] = [];
    for (const me in this.modelDef.contents) {
      const ent = this.modelDef.contents[me];
      if (ent.type === 'struct') {
        explores.push(new Explore(ent));
      }
    }
    return explores;
  }

  public get exportedExplores(): Explore[] {
    return this.explores.filter(explore =>
      this.modelDef.exports.includes(explore.name)
    );
  }

  public get _modelDef(): ModelDef {
    return this.modelDef;
  }
}

/**
 * A prepared query which has all the necessary information to produce its SQL.
 */
export class PreparedQuery implements Taggable {
  public _modelDef: ModelDef;
  public _query: InternalQuery | NamedQuery;
  public name?: string;

  constructor(query: InternalQuery, model: ModelDef, name?: string) {
    this._query = query;
    this._modelDef = model;
    this.name = name;
  }

  getTags(): Tags {
    return new Tags(this._query.annotation);
  }

  /**
   * Generate the SQL for this query.
   *
   * @return A fully-prepared query (which contains the generated SQL).
   */
  public get preparedResult(): PreparedResult {
    const queryModel = new QueryModel(this._modelDef);
    const translatedQuery = queryModel.compileQuery(this._query);
    return new PreparedResult(
      {
        ...translatedQuery,
        queryName: this.name || translatedQuery.queryName,
      },
      this._modelDef
    );
  }

  public get dialect(): string {
    const sourceRef = this._query.structRef;
    const source =
      typeof sourceRef === 'string'
        ? this._modelDef.contents[sourceRef]
        : sourceRef;
    if (source.type !== 'struct') {
      throw new Error('Invalid source for query');
    }
    return source.dialect;
  }

  /**
   * Get the flattened version of a query -- one that does not have a `pipeHead`.
   */
  public getFlattenedQuery(defaultName: string): PreparedQuery {
    let structRef = this._query.structRef;
    if (typeof structRef !== 'string') {
      structRef = structRef.as || structRef.name;
    }
    const turtleDef = flattenQuery(this._modelDef, {
      ...this._query,
      type: 'query',
      name:
        'as' in this._query ? this._query.as || this._query.name : defaultName,
    });
    return new PreparedQuery(
      {...turtleDef, structRef, type: 'query'},
      this._modelDef,
      this.name || turtleDef.as || turtleDef.name
    );
  }
}

/**
 * A parsed Malloy document.
 */
export class Parse {
  private translator: MalloyTranslator;

  constructor(translator: MalloyTranslator) {
    this.translator = translator;
  }

  /**
   * Retrieve the document highlights for the parsed document.
   *
   * These highlights represent the parsed tokens contained in the document,
   * and may be used for syntax highlighting in an IDE, for example.
   *
   * @return An array of document highlights.
   */
  public get highlights(): DocumentHighlight[] {
    return (this.translator.metadata().highlights || []).map(
      highlight => new DocumentHighlight(highlight)
    );
  }

  /**
   * Retrieve the symbols defined in the parsed document.
   *
   * These symbols represent any object defined (e.g. `Query`s and `Explore`s)
   * in the document.
   *
   * @return An array of document symbols.
   */
  public get symbols(): DocumentSymbol[] {
    return (this.translator.metadata().symbols || []).map(
      symbol => new DocumentSymbol(symbol)
    );
  }

  public get _translator(): MalloyTranslator {
    return this.translator;
  }

  public completions(position: {
    line: number;
    character: number;
  }): DocumentCompletion[] {
    return (this.translator.completions(position).completions || []).map(
      completion => new DocumentCompletion(completion)
    );
  }

  public helpContext(position: {
    line: number;
    character: number;
  }): DocumentHelpContext | undefined {
    return this.translator.helpContext(position).helpContext;
  }
}

/**
 * A document highlight.
 *
 * Represents a parsed token contained in a Malloy document
 * and may be used for syntax highlighting in an IDE, for example.
 */
export class DocumentHighlight {
  private _range: DocumentRange;
  private _type: string;

  constructor(documentHighlight: DocumentHighlightDefinition) {
    this._range = new DocumentRange(
      new DocumentPosition(
        documentHighlight.range.start.line,
        documentHighlight.range.start.character
      ),
      new DocumentPosition(
        documentHighlight.range.end.line,
        documentHighlight.range.end.character
      )
    );
    this._type = documentHighlight.type;
  }

  /**
   * @return The range of characters this highlight spans within its source document.
   */
  get range(): DocumentRange {
    return this._range;
  }

  /**
   * @return The type of highlight, which may be any `HighlightType`.
   */
  get type(): string {
    return this._type;
  }
}

/**
 * A range of characters within a Malloy document.
 */
export class DocumentRange {
  private _start: DocumentPosition;
  private _end: DocumentPosition;

  constructor(start: DocumentPosition, end: DocumentPosition) {
    this._start = start;
    this._end = end;
  }

  /**
   * @return The position of the first character in the range.
   */
  public get start(): DocumentPosition {
    return this._start;
  }

  /**
   * @return The position of the last character in the range.
   */
  public get end(): DocumentPosition {
    return this._end;
  }

  /**
   * @return This range in JSON format.
   */
  public toJSON(): {
    start: {line: number; character: number};
    end: {line: number; character: number};
  } {
    return {
      start: this.start.toJSON(),
      end: this.end.toJSON(),
    };
  }

  /**
   * Construct a DocumentRange from JSON.
   */
  public static fromJSON(json: {
    start: {line: number; character: number};
    end: {line: number; character: number};
  }): DocumentRange {
    return new DocumentRange(
      new DocumentPosition(json.start.line, json.start.character),
      new DocumentPosition(json.end.line, json.end.character)
    );
  }
}

/**
 * A position within a Malloy document.
 */
export class DocumentPosition {
  private _line: number;
  private _character: number;

  constructor(line: number, character: number) {
    this._line = line;
    this._character = character;
  }

  /**
   * @return The line number of the position.
   */
  public get line(): number {
    return this._line;
  }

  /**
   * @return The character index on the line `this.getLine()`.
   */
  public get character(): number {
    return this._character;
  }

  /**
   * @return This position in JSON format.
   */
  public toJSON(): {line: number; character: number} {
    return {line: this.line, character: this.character};
  }
}

/**
 * A symbol defined in a Malloy document.
 *
 * Represents any object defined (e.g. `Query`s and `Explore`s) in the document.
 */
export class DocumentSymbol {
  private _range: DocumentRange;
  private _lensRange: DocumentRange | undefined;
  private _type: string;
  private _name: string;
  private _children: DocumentSymbol[];

  constructor(documentSymbol: DocumentSymbolDefinition) {
    this._range = DocumentRange.fromJSON(documentSymbol.range);
    this._lensRange = documentSymbol.lensRange
      ? DocumentRange.fromJSON(documentSymbol.lensRange)
      : undefined;
    this._type = documentSymbol.type;
    this._name = documentSymbol.name;
    this._children = documentSymbol.children.map(
      child => new DocumentSymbol(child)
    );
  }

  /**
   * @return The range of characters in the source Malloy document that define this symbol.
   */
  public get range(): DocumentRange {
    return this._range;
  }

  /**
   * @return The range of characters in the source Malloy document that define this symbol,
   * including tags. Note: "block tags" are included if there is exactly one
   * definition in the block.
   */
  public get lensRange(): DocumentRange {
    return this._lensRange ?? this._range;
  }

  /**
   * @return The type of symbol.
   *
   * Possible values are: `"explore"`, `"query"`, `"field"`, `"turtle"`, `"join"`, or `"unnamed_query"`.
   */
  public get type(): string {
    return this._type;
  }

  /**
   * @return The name of this symbol, e.g. the `Explore` name or `Query` name.
   *
   * For type `"unnamed_query"`, `getName()` is `"unnamed_query"`.
   */
  public get name(): string {
    return this._name;
  }

  /**
   * @return An array of document symbols defined inside this document symbol,
   * e.g. fields in an `Explore`.
   */
  public get children(): DocumentSymbol[] {
    return this._children;
  }
}

export class DocumentCompletion {
  public readonly type: string;
  public readonly text: string;

  constructor(completion: DocumentCompletionDefinition) {
    this.type = completion.type;
    this.text = completion.text;
  }
}

/**
 * A fully-prepared query containing SQL and metadata required to run the query.
 */
export class PreparedResult implements Taggable {
  protected inner: CompiledQuery;
  protected modelDef: ModelDef;

  constructor(query: CompiledQuery, modelDef: ModelDef) {
    this.inner = query;
    this.modelDef = modelDef;
  }

  public getTags(): Tags {
    return new Tags(this.inner.annotation);
  }

  /**
   * @return The name of the connection this query should be run against.
   */
  public get connectionName(): string {
    return this.inner.connectionName;
  }

  public get _rawQuery(): CompiledQuery {
    return this.inner;
  }

  public get _modelDef(): ModelDef {
    return this.modelDef;
  }

  /**
   * @return The SQL that should be run against the SQL runner
   * with the connection name `this.getConnectionName()`.
   */
  public get sql(): string {
    return this.inner.sql;
  }

  /**
   * @return The `Explore` representing the data that will be returned by running this query.
   */
  public get resultExplore(): Explore {
    if (this.inner.structs.length === 0) {
      throw new Error('Malformed query result.');
    }
    const explore = this.inner.structs[this.inner.structs.length - 1];
    const namedExplore = {
      ...explore,
      name: this.inner.queryName || explore.name,
    };
    // TODO `sourceExplore` is not fully-implemented yet -- it cannot
    //      handle cases where the source of the query is something other than
    //      a named explore.
    try {
      return new Explore(namedExplore, this.sourceExplore);
    } catch (error) {
      return new Explore(namedExplore);
    }
  }

  public get sourceExplore(): Explore {
    const name = this.inner.sourceExplore;
    const explore = this.modelDef.contents[name];
    if (explore === undefined) {
      throw new Error('Malformed query result.');
    }
    if (explore.type === 'struct') {
      return new Explore(explore);
    }
    throw new Error(`'${name} is not an explore`);
  }

  public get _sourceExploreName(): string {
    return this.inner.sourceExplore;
  }

  public get _sourceFilters(): FilterExpression[] {
    return this.inner.sourceFilters || [];
  }
}

/**
 * A URL reader which always throws an error when a URL's contents is requested.
 *
 * Useful for scenarios in which `import` statements are not required.
 */
export class EmptyURLReader implements URLReader {
  async readURL(_url: URL): Promise<string> {
    throw new Error('No files.');
  }
}

/**
 * A URL reader backed by an in-memory mapping of URL contents.
 */
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

/**
 * A fixed mapping of connection names to connections.
 */
export class FixedConnectionMap implements LookupConnection<Connection> {
  private connections: Map<string, Connection>;
  private defaultConnectionName?: string;
  constructor(
    connections: Map<string, Connection>,
    defaultConnectionName?: string
  ) {
    this.connections = connections;
    this.defaultConnectionName = defaultConnectionName;
  }

  /**
   * Get a connection by name.
   *
   * @param connectionName The name of the connection to look up.
   * @return A `Connection`
   * @throws An `Error` if no connection with the given name exists.
   */
  public async getConnection(connectionName?: string): Promise<Connection> {
    if (connectionName === undefined) {
      if (this.defaultConnectionName !== undefined) {
        connectionName = this.defaultConnectionName;
      } else {
        throw new Error('No default connection.');
      }
    }

    const connection = this.connections.get(connectionName);
    if (connection !== undefined) {
      return Promise.resolve(connection);
    } else {
      throw new Error(`No connection found with name ${connectionName}.`);
    }
  }

  public async lookupConnection(connectionName?: string): Promise<Connection> {
    return this.getConnection(connectionName);
  }

  public static fromArray(connections: Connection[]): FixedConnectionMap {
    return new FixedConnectionMap(
      new Map(connections.map(connection => [connection.name, connection]))
    );
  }
}

/**
 * The relationship of an `Explore` to its source.
 */
export enum SourceRelationship {
  /**
   * The `Explore` is nested data within the source's rows.
   */
  Nested = 'nested',

  /**
   * The `Explore` is the base table.
   */
  BaseTable = 'base_table',

  /**
   * The `Explore` is joined to its source
   */
  Cross = 'cross',
  One = 'one',
  Many = 'many',

  // TODO document this
  Inline = 'inline',
}

abstract class Entity {
  private readonly _name: string;
  protected readonly _parent?: Explore;
  private readonly _source?: Entity;

  constructor(name: string, parent?: Explore, source?: Entity) {
    this._name = name;
    this._parent = parent;
    this._source = source;
  }

  public get source(): Entity | undefined {
    return this.source;
  }

  public get name(): string {
    return this._name;
  }

  public get sourceClasses(): string[] {
    const sourceClasses: string[] = [];
    if (this.source) {
      sourceClasses.push(this.source.name);
    }
    sourceClasses.push(this.name);
    return sourceClasses;
  }

  public hasParentExplore(): this is Field {
    return this._parent !== undefined;
  }

  isExplore(): this is Explore {
    return this instanceof Explore;
  }

  isQuery(): this is Query {
    return this instanceof QueryField;
  }

  public abstract isIntrinsic(): boolean;
}

export type Field = AtomicField | QueryField | ExploreField;
export type SerializedExplore = {
  _structDef: StructDef;
  sourceExplore?: SerializedExplore;
  _parentExplore?: SerializedExplore;
};

export class Explore extends Entity {
  protected readonly _structDef: StructDef;
  protected readonly _parentExplore?: Explore;
  private _fieldMap: Map<string, Field> | undefined;
  private sourceExplore: Explore | undefined;

  constructor(structDef: StructDef, parentExplore?: Explore, source?: Explore) {
    super(structDef.as || structDef.name, parentExplore, source);
    this._structDef = structDef;
    this._parentExplore = parentExplore;
    this.sourceExplore = source;
  }

  public get source(): Explore | undefined {
    return this.sourceExplore;
  }

  public isIntrinsic(): boolean {
    return FieldIsIntrinsic(this._structDef);
  }

  /**
   * @return The name of the entity.
   */
  public get name(): string {
    return this.structDef.as || this.structDef.name;
  }

  public getQueryByName(name: string): PreparedQuery {
    const internalQuery: InternalQuery = {
      type: 'query',
      structRef: this.structDef,
      pipeline: [
        {
          type: 'reduce',
          fields: [name],
        },
      ],
    };
    return new PreparedQuery(internalQuery, this.modelDef, name);
  }

  private get modelDef(): ModelDef {
    return {
      name: 'generated_model',
      exports: [],
      contents: {[this.structDef.name]: this.structDef},
    };
  }

  public getSingleExploreModel(): Model {
    return new Model(this.modelDef, [], [], []);
  }

  private get fieldMap(): Map<string, Field> {
    if (this._fieldMap === undefined) {
      const sourceFields = this.source?.fieldMap || new Map();
      this._fieldMap = new Map(
        this.structDef.fields.map(fieldDef => {
          const name = fieldDef.as || fieldDef.name;
          const sourceField = sourceFields.get(fieldDef.name);
          if (fieldDef.type === 'struct') {
            return [name, new ExploreField(fieldDef, this, sourceField)];
          } else if (fieldDef.type === 'turtle') {
            return [name, new QueryField(fieldDef, this, sourceField)];
          } else {
            if (fieldDef.type === 'string') {
              return [name, new StringField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'number') {
              return [name, new NumberField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'date') {
              // TODO this is a hack
              // Is this a bug? The extraction functions don't seem like they should return a
              // field of type "date". Rather, they should be of type "number".
              if (
                fieldDef.timeframe &&
                ['day_of_month', 'day_of_week', 'day_of_year'].includes(
                  fieldDef.timeframe
                )
              ) {
                return [
                  name,
                  new NumberField(
                    {...fieldDef, type: 'number'},
                    this,
                    sourceField
                  ),
                ];
              }
              return [name, new DateField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'timestamp') {
              return [name, new TimestampField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'boolean') {
              return [name, new BooleanField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'json') {
              return [name, new JSONField(fieldDef, this, sourceField)];
            } else if (fieldDef.type === 'unsupported') {
              return [name, new UnsupportedField(fieldDef, this, sourceField)];
            }
          }
        }) as [string, Field][]
      );
    }
    return this._fieldMap;
  }

  public get allFields(): Field[] {
    return [...this.fieldMap.values()];
  }

  public get intrinsicFields(): Field[] {
    return [...this.fieldMap.values()].filter(f => f.isIntrinsic());
  }

  public getFieldByName(fieldName: string): Field {
    const field = this.fieldMap.get(fieldName);
    if (field === undefined) {
      throw new Error(`No such field ${fieldName}.`);
    }
    return field;
  }

  public getFieldByNameIfExists(fieldName: string): Field | undefined {
    return this.fieldMap.get(fieldName);
  }

  public get primaryKey(): string | undefined {
    return this.structDef.primaryKey;
  }

  public get parentExplore(): Explore | undefined {
    return this._parentExplore;
  }

  public get sourceRelationship(): SourceRelationship {
    switch (this.structDef.structRelationship.type) {
      case 'many':
        return SourceRelationship.Many;
      case 'one':
        return SourceRelationship.One;
      case 'cross':
        return SourceRelationship.Cross;
      case 'inline':
        return SourceRelationship.Inline;
      case 'nested':
        return SourceRelationship.Nested;
      case 'basetable':
        return SourceRelationship.BaseTable;
    }
  }

  public hasParentExplore(): this is ExploreField {
    return this instanceof ExploreField;
  }

  // TODO wrapper type for FilterExpression
  get filters(): FilterExpression[] {
    return this.structDef.resultMetadata?.filterList || [];
  }

  get limit(): number | undefined {
    return this.structDef.resultMetadata?.limit;
  }

  public get structDef(): StructDef {
    return this._structDef;
  }

  public get queryTimezone(): string | undefined {
    return this.structDef.queryTimezone;
  }

  public toJSON(): SerializedExplore {
    return {
      _structDef: this._structDef,
      sourceExplore: this.sourceExplore?.toJSON(),
      _parentExplore: this._parentExplore?.toJSON(),
    };
  }

  public static fromJSON(main_explore: SerializedExplore): Explore {
    const parentExplore =
      main_explore._parentExplore !== undefined
        ? Explore.fromJSON(main_explore._parentExplore)
        : undefined;
    const sourceExplore =
      main_explore.sourceExplore !== undefined
        ? Explore.fromJSON(main_explore.sourceExplore)
        : undefined;
    return new Explore(main_explore._structDef, parentExplore, sourceExplore);
  }
}

export enum AtomicFieldType {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Timestamp = 'timestamp',
  Json = 'json',
  Unsupported = 'unsupported',
  Error = 'error',
}

export class AtomicField extends Entity implements Taggable {
  protected fieldTypeDef: FieldTypeDef;
  protected parent: Explore;

  constructor(
    fieldTypeDef: FieldTypeDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldTypeDef.as || fieldTypeDef.name, parent, source);
    this.fieldTypeDef = fieldTypeDef;
    this.parent = parent;
  }

  public get type(): AtomicFieldType {
    switch (this.fieldTypeDef.type) {
      case 'string':
        return AtomicFieldType.String;
      case 'boolean':
        return AtomicFieldType.Boolean;
      case 'date':
        return AtomicFieldType.Date;
      case 'timestamp':
        return AtomicFieldType.Timestamp;
      case 'number':
        return AtomicFieldType.Number;
      case 'json':
        return AtomicFieldType.Json;
      case 'unsupported':
        return AtomicFieldType.Unsupported;
      case 'error':
        return AtomicFieldType.Error;
    }
  }

  getTags(): Tags {
    return new Tags(this.fieldTypeDef.annotation);
  }

  public isIntrinsic(): boolean {
    return FieldIsIntrinsic(this.fieldTypeDef);
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

  public isCalculation(): boolean {
    //return !!this.fieldTypeDef.aggregate;
    return expressionIsCalculation(this.fieldTypeDef.expressionType);
  }

  public get sourceField(): Field {
    // TODO
    throw new Error();
  }

  public get sourceClasses(): string[] {
    const sourceField = this.fieldTypeDef.name || this.fieldTypeDef.as;
    return sourceField ? [sourceField] : [];
  }

  // was the field generated from a measure in the previous query
  public sourceWasMeasure(): boolean {
    return this.fieldTypeDef.resultMetadata?.fieldKind === 'measure';
  }

  public sourceWasMeasureLike(): boolean {
    return (
      this.fieldTypeDef.resultMetadata?.fieldKind === 'measure' ||
      this.fieldTypeDef.resultMetadata?.fieldKind === 'struct'
    );
  }

  public sourceWasDimension(): boolean {
    return this.fieldTypeDef.resultMetadata?.fieldKind === 'dimension';
  }

  public hasParentExplore(): this is Field {
    return true;
  }

  public isString(): this is StringField {
    return this instanceof StringField;
  }

  public isNumber(): this is NumberField {
    return this instanceof NumberField;
  }

  public isDate(): this is DateField {
    return this instanceof DateField;
  }

  public isBoolean(): this is BooleanField {
    return this instanceof BooleanField;
  }

  public isJSON(): this is JSONField {
    return this instanceof JSONField;
  }

  public isTimestamp(): this is TimestampField {
    return this instanceof TimestampField;
  }

  public isUnsupported(): this is UnsupportedField {
    return this instanceof UnsupportedField;
  }

  get parentExplore(): Explore {
    return this.parent;
  }

  get expression(): string {
    return (
      this.fieldTypeDef.resultMetadata?.sourceExpression ||
      this.fieldTypeDef.resultMetadata?.sourceField ||
      this.name
    );
  }
}

export enum DateTimeframe {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Quarter = 'quarter',
  Year = 'year',
}

export enum TimestampTimeframe {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Quarter = 'quarter',
  Year = 'year',
  Second = 'second',
  Hour = 'hour',
  Minute = 'minute',
}

export class DateField extends AtomicField {
  private fieldDateDef: FieldDateDef;
  constructor(
    fieldDateDef: FieldDateDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldDateDef, parent, source);
    this.fieldDateDef = fieldDateDef;
  }

  get timeframe(): DateTimeframe | undefined {
    if (this.fieldDateDef.timeframe === undefined) {
      return undefined;
    }
    switch (this.fieldDateDef.timeframe) {
      case 'day':
        return DateTimeframe.Day;
      case 'week':
        return DateTimeframe.Week;
      case 'month':
        return DateTimeframe.Month;
      case 'quarter':
        return DateTimeframe.Quarter;
      case 'year':
        return DateTimeframe.Year;
    }
  }
}

export class TimestampField extends AtomicField {
  private fieldTimestampDef: FieldTimestampDef;
  constructor(
    fieldTimestampDef: FieldTimestampDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldTimestampDef, parent, source);
    this.fieldTimestampDef = fieldTimestampDef;
  }

  get timeframe(): TimestampTimeframe | undefined {
    if (this.fieldTimestampDef.timeframe === undefined) {
      return undefined;
    }
    switch (this.fieldTimestampDef.timeframe) {
      case 'day':
        return TimestampTimeframe.Day;
      case 'week':
        return TimestampTimeframe.Week;
      case 'month':
        return TimestampTimeframe.Month;
      case 'quarter':
        return TimestampTimeframe.Quarter;
      case 'year':
        return TimestampTimeframe.Year;
      case 'second':
        return TimestampTimeframe.Second;
      case 'hour':
        return TimestampTimeframe.Hour;
      case 'minute':
        return TimestampTimeframe.Minute;
    }
  }
}

export class NumberField extends AtomicField {
  private fieldNumberDef: FieldNumberDef;
  constructor(
    fieldNumberDef: FieldNumberDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldNumberDef, parent, source);
    this.fieldNumberDef = fieldNumberDef;
  }
}

export class BooleanField extends AtomicField {
  private fieldBooleanDef: FieldBooleanDef;
  constructor(
    fieldBooleanDef: FieldBooleanDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldBooleanDef, parent, source);
    this.fieldBooleanDef = fieldBooleanDef;
  }
}

export class JSONField extends AtomicField {
  private fieldJSONDef: FieldJSONDef;
  constructor(
    fieldJSONDef: FieldJSONDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldJSONDef, parent, source);
    this.fieldJSONDef = fieldJSONDef;
  }
}

export class UnsupportedField extends AtomicField {
  private fieldUnsupportedDef: FieldUnsupportedDef;
  constructor(
    fieldUnsupportedDef: FieldUnsupportedDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldUnsupportedDef, parent, source);
    this.fieldUnsupportedDef = fieldUnsupportedDef;
  }
}

export class StringField extends AtomicField {
  private fieldStringDef: FieldStringDef;
  constructor(
    fieldStringDef: FieldStringDef,
    parent: Explore,
    source?: AtomicField
  ) {
    super(fieldStringDef, parent, source);
    this.fieldStringDef = fieldStringDef;
  }
}

export class Query extends Entity {
  protected turtleDef: TurtleDef;
  private sourceQuery?: Query;

  constructor(turtleDef: TurtleDef, parent?: Explore, source?: Query) {
    super(turtleDef.as || turtleDef.name, parent, source);
    this.turtleDef = turtleDef;
  }

  public get source(): Query | undefined {
    return this.sourceQuery;
  }

  public isIntrinsic(): boolean {
    return false;
  }
}

export class QueryField extends Query implements Taggable {
  protected parent: Explore;

  constructor(turtleDef: TurtleDef, parent: Explore, source?: Query) {
    super(turtleDef, parent, source);
    this.parent = parent;
  }

  getTags(): Tags {
    return new Tags(this.turtleDef.annotation);
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

  public get sourceClasses(): string[] {
    const sourceField = this.turtleDef.name || this.turtleDef.as;
    return sourceField ? [sourceField] : [];
  }

  public hasParentExplore(): this is Field {
    return true;
  }

  get parentExplore(): Explore {
    return this.parent;
  }

  get expression(): string {
    return this.name;
  }
}

export enum JoinRelationship {
  OneToOne = 'one_to_one',
  OneToMany = 'one_to_many',
  ManyToOne = 'many_to_one',
}

export class ExploreField extends Explore implements Taggable {
  protected _parentExplore: Explore;

  constructor(structDef: StructDef, parentExplore: Explore, source?: Explore) {
    super(structDef, parentExplore, source);
    this._parentExplore = parentExplore;
  }

  public get joinRelationship(): JoinRelationship {
    switch (this.structDef.structRelationship.type) {
      case 'one':
        return JoinRelationship.OneToMany;
      case 'many':
      case 'cross':
        return JoinRelationship.ManyToOne;
      case 'inline':
        return JoinRelationship.OneToOne;
      case 'nested':
        return JoinRelationship.ManyToOne;
      default:
        throw new Error('A source field must have a join relationship.');
    }
  }

  getTags(): Tags {
    return new Tags(this._structDef.annotation);
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

  public get parentExplore(): Explore {
    return this._parentExplore;
  }

  public get sourceClasses(): string[] {
    const sourceField = this.structDef.name || this.structDef.as;
    return sourceField ? [sourceField] : [];
  }
}

/**
 * An environment for compiling and running Malloy queries.
 */
export class Runtime {
  private _urlReader: URLReader;
  private _connections: LookupConnection<Connection>;

  constructor(runtime: LookupConnection<Connection> & URLReader);
  constructor(urls: URLReader, connections: LookupConnection<Connection>);
  constructor(urls: URLReader, connection: Connection);
  constructor(connection: Connection);
  constructor(connections: LookupConnection<Connection>);
  constructor(
    ...args: (URLReader | LookupConnection<Connection> | Connection)[]
  ) {
    let urlReader: URLReader | undefined;
    let connections: LookupConnection<Connection> | undefined;
    for (const arg of args) {
      if (isURLReader(arg)) {
        urlReader = arg;
      } else if (isLookupConnection<Connection>(arg)) {
        connections = arg;
      } else {
        connections = {
          lookupConnection: () => Promise.resolve(arg),
        };
      }
    }
    if (urlReader === undefined) {
      urlReader = new EmptyURLReader();
    }
    if (connections === undefined) {
      throw new Error(
        'A LookupConnection<Connection> or Connection is required.'
      );
    }
    this._urlReader = urlReader;
    this._connections = connections;
  }

  /**
   * @return The `URLReader` for this runtime instance.
   */
  public get urlReader(): URLReader {
    return this._urlReader;
  }

  /**
   * @return The `LookupConnection<Connection>` for this runtime instance.
   */
  public get connections(): LookupConnection<Connection> {
    return this._connections;
  }

  /**
   * Load a Malloy model by URL or contents.
   *
   * @param source The model URL or contents to load and (eventually) compile.
   * @return A `ModelMaterializer` capable of materializing the requested model,
   * or loading further related objects.
   */
  public loadModel(source: ModelURL | ModelString): ModelMaterializer {
    return new ModelMaterializer(this, async () => {
      const parse =
        source instanceof URL
          ? await Malloy.parse({
              url: source,
              urlReader: this.urlReader,
            })
          : Malloy.parse({
              source,
            });
      return Malloy.compile({
        urlReader: this.urlReader,
        connections: this.connections,
        parse,
      });
    });
  }

  // TODO Consider formalizing this. Perhaps as a `withModel` method,
  //      as well as a `Model.fromModelDefinition` if we choose to expose
  //      `ModelDef` to the world formally. For now, this should only
  //      be used in tests.
  public _loadModelFromModelDef(modelDef: ModelDef): ModelMaterializer {
    return new ModelMaterializer(this, async () => {
      return new Model(modelDef, [], [], []);
    });
  }

  /**
   * Load a Malloy query by URL or contents.
   *
   * @param query The query URL or contents to load and (eventually) compile.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQuery(query: QueryURL | QueryString): QueryMaterializer {
    return this.loadModel(query).loadFinalQuery();
  }

  /**
   * Load a Malloy query by the URL or contents of a Malloy model document
   * and the index of an unnamed query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param index The index of the query to use within the model.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByIndex(
    model: ModelURL | ModelString,
    index: number
  ): QueryMaterializer {
    return this.loadModel(model).loadQueryByIndex(index);
  }

  /**
   * Load a Malloy query by the URL or contents of a Malloy model document
   * and the name of a query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param name The name of the query to use within the model.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByName(
    model: ModelURL | ModelString,
    name: string
  ): QueryMaterializer {
    return this.loadModel(model).loadQueryByName(name);
  }

  /**
   * Load a SQL block by the URL or contents of a Malloy model document
   * and the name of a query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param name The name of the sql block to use within the model.
   * @return A `SQLBlockMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadSQLBlockByName(
    model: ModelURL | ModelString,
    name: string
  ): SQLBlockMaterializer {
    return this.loadModel(model).loadSQLBlockByName(name);
  }

  /**
   * Load a SQL block by the URL or contents of a Malloy model document
   * and the name of a query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param index The index of the SQL block to use within the model. Note: named blocks are indexable, too.
   * @return A `SQLBlockMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadSQLBlockByIndex(
    model: ModelURL | ModelString,
    index: number
  ): SQLBlockMaterializer {
    return this.loadModel(model).loadSQLBlockByIndex(index);
  }

  // TODO maybe use overloads for the alternative parameters
  /**
   * Compile a Malloy model by URL or contents.
   *
   * @param source The URL or contents of a Malloy model document to compile.
   * @return A promise of a compiled `Model`.
   */
  public getModel(source: ModelURL | ModelString): Promise<Model> {
    return this.loadModel(source).getModel();
  }

  /**
   * Compile a Malloy query by URL or contents.
   *
   * @param query The URL or contents of a Malloy query document to compile.
   * @return A promise of a compiled `PreparedQuery`.
   */
  public getQuery(query: QueryURL | QueryString): Promise<PreparedQuery> {
    return this.loadQuery(query).getPreparedQuery();
  }

  /**
   * Compile a Malloy query by the URL or contents of a model document
   * and the index of an unnamed query contained within the model.
   *
   * @param model The URL or contents of a Malloy model document to compile.
   * @param index The index of an unnamed query contained within the model.
   * @return A promise of a compiled `PreparedQuery`.
   */
  public getQueryByIndex(
    model: ModelURL | ModelString,
    index: number
  ): Promise<PreparedQuery> {
    return this.loadQueryByIndex(model, index).getPreparedQuery();
  }

  /**
   * Compile a Malloy query by the URL or contents of a model document
   * and the name of a query contained within the model.
   *
   * @param model The URL or contents of a Malloy model document to compile.
   * @param name The name of a query contained within the model.
   * @return A promise of a compiled `PreparedQuery`.
   */
  public getQueryByName(
    model: ModelURL | ModelString,
    name: string
  ): Promise<PreparedQuery> {
    return this.loadQueryByName(model, name).getPreparedQuery();
  }

  /**
   * Get a SQL block by the URL or contents of a Malloy model document
   * and the name of a SQL block contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param name The name of the sql block to use within the model.
   * @return A promise of a `CompiledSQLBlock`.
   */
  public getSQLBlockByName(
    model: ModelURL | ModelString,
    name: string
  ): Promise<SQLBlockStructDef> {
    return this.loadSQLBlockByName(model, name).getSQLBlock();
  }

  /**
   * Get a SQL block by the URL or contents of a Malloy model document
   * and the name of a query contained in the model.
   *
   * @param model The model URL or contents to load and (eventually) compile to retrieve the requested query.
   * @param index The index of the SQL block to use within the model. Note: named blocks are indexable, too.
   * @return A promise of a `SQLBlock`.
   */
  public getSQLBlockByIndex(
    model: ModelURL | ModelString,
    index: number
  ): Promise<SQLBlockStructDef> {
    return this.loadSQLBlockByIndex(model, index).getSQLBlock();
  }
}

export class ConnectionRuntime extends Runtime {
  public readonly rawConnections: Connection[];

  constructor(urls: URLReader, connections: Connection[]);
  constructor(connections: Connection[]);
  constructor(
    urlsOrConnections: URLReader | Connection[],
    maybeConnections?: Connection[]
  ) {
    if (maybeConnections === undefined) {
      const connections = urlsOrConnections as Connection[];
      super(FixedConnectionMap.fromArray(connections));
      this.rawConnections = connections;
    } else {
      const connections = maybeConnections as Connection[];
      super(
        urlsOrConnections as URLReader,
        FixedConnectionMap.fromArray(connections)
      );
      this.rawConnections = connections;
    }
  }
}

export class SingleConnectionRuntime<
  T extends Connection = Connection
> extends Runtime {
  public readonly connection: T;

  constructor(urls: URLReader, connection: T);
  constructor(connection: T);
  constructor(urlsOrConnections: URLReader | T, maybeConnections?: T) {
    if (maybeConnections === undefined) {
      const connection = urlsOrConnections as T;
      super(connection);
      this.connection = connection;
    } else {
      const connection = maybeConnections as T;
      super(urlsOrConnections as URLReader, connection);
      this.connection = connection;
    }
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

  protected makeSQLBlockMaterializer(
    materialize: () => Promise<SQLBlockStructDef>
  ): SQLBlockMaterializer {
    return new SQLBlockMaterializer(this.runtime, materialize);
  }
}

/**
 * An object representing the task of loading a `Model`, capable of
 * materializing that model (via `getModel()`) or extending the task to load
 * queries or explores (via e.g. `loadFinalQuery()`, `loadQuery`, `loadExploreByName`, etc.).
 */
export class ModelMaterializer extends FluentState<Model> {
  /**
   * Load the final (unnamed) Malloy query contained within this loaded `Model`.
   *
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadFinalQuery(): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).preparedQuery;
    });
  }

  /**
   * Load an unnamed query contained within this loaded `Model` by index.
   *
   * @param index The index of the query to load.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByIndex(index: number): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQueryByIndex(index);
    });
  }

  /**
   * Load a query contained within this loaded `Model` by its name.
   *
   * @param name The name of the query to load.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByName(name: string): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getPreparedQueryByName(name);
    });
  }

  /**
   * Load a query against this loaded `Model` by its URL or contents.
   *
   * @param query The URL or contents of the query to load and (eventually) compile.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQuery(query: QueryString | QueryURL): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      const urlReader = this.runtime.urlReader;
      const connections = this.runtime.connections;
      const parse =
        query instanceof URL
          ? await Malloy.parse({
              url: query,
              urlReader,
            })
          : Malloy.parse({
              source: query,
            });
      const model = await this.getModel();
      const queryModel = await Malloy.compile({
        urlReader,
        connections,
        parse,
        model,
      });
      return queryModel.preparedQuery;
    });
  }

  /**
   * Extend a Malloy model by URL or contents.
   *
   * @param source The model URL or contents to load and (eventually) compile.
   * @return A `ModelMaterializer` capable of materializing the requested model,
   * or loading further related objects.
   */
  public extendModel(query: QueryString | QueryURL): ModelMaterializer {
    return new ModelMaterializer(this.runtime, async () => {
      const urlReader = this.runtime.urlReader;
      const connections = this.runtime.connections;
      const parse =
        query instanceof URL
          ? await Malloy.parse({
              url: query,
              urlReader,
            })
          : Malloy.parse({
              source: query,
            });
      const model = await this.getModel();
      const queryModel = await Malloy.compile({
        urlReader,
        connections,
        parse,
        model,
      });
      return queryModel;
    });
  }

  public async search(
    sourceName: string,
    searchTerm: string,
    limit = 1000,
    searchField: string | undefined = undefined
  ): Promise<SearchIndexResult[] | undefined> {
    const model = await this.materialize();
    const queryModel = new QueryModel(model._modelDef);
    const schema = model.getExploreByName(sourceName).structDef;
    if (schema.structRelationship.type !== 'basetable') {
      throw new Error(
        "Expected schema's structRelationship type to be 'basetable'."
      );
    }
    const connectionName = schema.structRelationship.connectionName;
    const connection = await this.runtime.connections.lookupConnection(
      connectionName
    );
    return await queryModel.searchIndex(
      connection,
      sourceName,
      searchTerm,
      limit,
      searchField
    );
  }

  public async searchValueMap(
    sourceName: string,
    limit = 10
  ): Promise<SearchValueMapResult[] | undefined> {
    const model = await this.materialize();
    const schema = model.getExploreByName(sourceName);
    if (schema.structDef.structRelationship.type !== 'basetable') {
      throw new Error(
        "Expected schema's structRelationship type to be 'basetable'."
      );
    }
    let indexQuery = '{index: *}';

    if (schema.getFieldByNameIfExists('search_index')) {
      indexQuery = 'search_index';
    }

    const searchMapMalloy = `
      query: ${sourceName}
        -> ${indexQuery}
        -> {
          where: fieldType = 'string'
          group_by: fieldName
          aggregate: cardinality is count(distinct fieldValue)
          nest: values is {
            project: fieldValue, weight
            order_by: weight desc
            limit: ${limit}
          }
          limit: 1000
        }
    `;
    const result = await this.loadQuery(searchMapMalloy).run({
      rowLimit: 1000,
    });
    return result._queryResult.result as unknown as SearchValueMapResult[];
  }

  /**
   * Load a SQL Block by name.
   *
   * @param name The name of the SQL Block to load.
   * @return A `SQLBlockMaterializer` capable of materializing the requested sql block, running it,
   * or loading further related objects.
   */
  public loadSQLBlockByName(name: string): SQLBlockMaterializer {
    return this.makeSQLBlockMaterializer(async () => {
      return (await this.materialize()).getSQLBlockByName(name);
    });
  }

  /**
   * Load a SQL Block by index.
   *
   * @param index The index of the SQL Block to load. Note: named SQL blocks are indexable, too.
   * @return A `SQLBlockMaterializer` capable of materializing the requested sql block, running it,
   * or loading further related objects.
   *
   * TODO feature-sql-block Should named SQL blocks be indexable? This is not the way unnamed queries work.
   */
  public loadSQLBlockByIndex(index: number): SQLBlockMaterializer {
    return this.makeSQLBlockMaterializer(async () => {
      return (await this.materialize()).getSQLBlockByIndex(index);
    });
  }

  /**
   * Materialize the final query contained within this loaded `Model`.
   *
   * @return A promise to a prepared query.
   */
  public getFinalQuery(): Promise<PreparedQuery> {
    return this.loadFinalQuery().getPreparedQuery();
  }

  /**
   * Materialize an unnamed query contained within this loaded `Model` by index.
   *
   * @param index The index of the query contained within this loaded `Model`.
   * @return A promise to a prepared query.
   */
  public getQueryByIndex(index: number): Promise<PreparedQuery> {
    return this.loadQueryByIndex(index).getPreparedQuery();
  }

  /**
   * Materialize a query contained within this loaded `Model` by name.
   *
   * @param name The name of the query contained within this loaded `Model`.
   * @return A promise to a prepared query.
   */
  public getQueryByName(name: string): Promise<PreparedQuery> {
    return this.loadQueryByName(name).getPreparedQuery();
  }

  /**
   * Materialize a query against this loaded `Model` by its URL or contents.
   *
   * @param query The URL or contents of a query document to compile.
   * @return A promise to a prepared query.
   */
  public getQuery(query: QueryString | QueryURL): Promise<PreparedQuery> {
    return this.loadQuery(query).getPreparedQuery();
  }

  /**
   * Get a SQL Block by name.
   *
   * @param name The name of the SQL Block to load.
   * @return A promise of a `SQLBlock`.
   */
  public getSQLBlockByName(name: string): Promise<SQLBlockStructDef> {
    return this.loadSQLBlockByName(name).getSQLBlock();
  }

  /**
   * Get a SQL Block by index.
   *
   * @param index The index of the SQL Block to load. Note: named SQL blocks are indexable, too.
   * @return A promise of a `SQLBlock`.
   *
   * TODO feature-sql-block Should named SQL blocks be indexable? This is not the way unnamed queries work.
   */
  public getSQLBlockByIndex(index: number): Promise<SQLBlockStructDef> {
    return this.loadSQLBlockByIndex(index).getSQLBlock();
  }

  // TODO Consider formalizing this. Perhaps as a `withQuery` method,
  //      as well as a `PreparedQuery.fromQueryDefinition` if we choose to expose
  //      `InternalQuery` to the world formally. For now, this should only
  //      be used in tests.
  public _loadQueryFromQueryDef(query: InternalQuery): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      const model = await this.materialize();
      return new PreparedQuery(query, model._modelDef);
    });
  }

  /**
   * Load an explore contained within this loaded `Model` by name.
   *
   * @param name The name of the explore contained within this loaded `Model`.
   * @return An `ExploreMaterializer` capable of materializing the requested explore,
   * or loading further related objects.
   */
  public loadExploreByName(name: string): ExploreMaterializer {
    return this.makeExploreMaterializer(async () => {
      return (await this.materialize()).getExploreByName(name);
    });
  }

  /**
   * Materialize an explore contained within this loaded `Model` by its name.
   *
   * @param query The name of an explore within this loaded `Model`.
   * @return A promise to an explore.
   */
  public getExploreByName(name: string): Promise<Explore> {
    return this.loadExploreByName(name).getExplore();
  }

  /**
   * Compile and materialize this loaded `Model`.
   *
   * @return A promise to the compiled model that is loaded.
   */
  public getModel(): Promise<Model> {
    return this.materialize();
  }
}

/**
 * An object representing the task of loading a `Query`, capable of
 * materializing the query (via `getPreparedQuery()`) or extending the task to load
 * prepared results or run the query (via e.g. `loadPreparedResult()` or `run()`).
 */
export class QueryMaterializer extends FluentState<PreparedQuery> {
  /**
   * Run this loaded `Query`.
   *
   * @return The query results from running this loaded query.
   */
  async run(options?: RunSQLOptions): Promise<Result> {
    const connections = this.runtime.connections;
    const preparedResult = await this.getPreparedResult();
    return Malloy.run({connections, preparedResult, options});
  }

  async *runStream(options?: {
    rowLimit?: number;
  }): AsyncIterableIterator<DataRecord> {
    const preparedResult = await this.getPreparedResult();
    const connections = this.runtime.connections;
    const stream = Malloy.runStream({connections, preparedResult, options});
    for await (const row of stream) {
      yield row;
    }
  }

  /**
   * Load the prepared result of this loaded query.
   *
   * @return A `PreparedResultMaterializer` capable of materializing the requested
   * prepared query or running it.
   */
  public loadPreparedResult(): PreparedResultMaterializer {
    return this.makePreparedResultMaterializer(async () => {
      return (await this.materialize()).preparedResult;
    });
  }

  /**
   * Materialize the prepared result of this loaded query.
   *
   * @return A promise of the prepared result of this loaded query.
   */
  public getPreparedResult(): Promise<PreparedResult> {
    return this.loadPreparedResult().getPreparedResult();
  }

  /**
   * Materialize the SQL of this loaded query.
   *
   * @return A promise of the SQL string.
   */
  public async getSQL(): Promise<string> {
    return (await this.getPreparedResult()).sql;
  }

  /**
   * Materialize this loaded query.
   *
   * @return A promise of the `PreparedQuery`.
   */
  public getPreparedQuery(): Promise<PreparedQuery> {
    return this.materialize();
  }

  /**
   * Estimates the cost of this loaded `Query`.
   *
   * @return The estimated cost of running this loaded query.
   */
  public async estimateQueryCost(): Promise<QueryRunStats> {
    const connections = this.runtime.connections;
    const preparedResult = await this.getPreparedResult();
    return Malloy.estimateQueryCost({connections, preparedResult});
  }
}

/**
 * An object representing the task of loading a `PreparedResult`, capable of
 * materializing the prepared result (via `getPreparedResult()`) or extending the task run
 * the query.
 */
export class PreparedResultMaterializer extends FluentState<PreparedResult> {
  /**
   * Run this prepared result.
   *
   * @return A promise to the query result data.
   */
  async run(options?: RunSQLOptions): Promise<Result> {
    const preparedResult = await this.getPreparedResult();
    const connections = this.runtime.connections;
    return Malloy.run({connections, preparedResult, options});
  }

  async *runStream(options?: {
    rowLimit?: number;
  }): AsyncIterableIterator<DataRecord> {
    const preparedResult = await this.getPreparedResult();
    const connections = this.runtime.connections;
    const stream = Malloy.runStream({connections, preparedResult, options});
    for await (const row of stream) {
      yield row;
    }
  }

  /**
   * Materialize this loaded prepared result.
   *
   * @return A promise of a prepared result.
   */
  public getPreparedResult(): Promise<PreparedResult> {
    return this.materialize();
  }

  /**
   * Materialize the SQL of this loaded prepared result.
   *
   * @return A promise to the SQL string.
   */
  public async getSQL(): Promise<string> {
    return (await this.getPreparedResult()).sql;
  }
}

/**
 * An object representing the task of loading a `SQLBlock`, capable of
 * materializing the SQLBlock (via `getSQLBlock()`) or extending the task run
 * the query.
 */
export class SQLBlockMaterializer extends FluentState<SQLBlockStructDef> {
  /**
   * Run this SQL block.
   *
   * @return A promise to the query result data.
   */
  async run(options?: RunSQLOptions): Promise<Result> {
    const sqlBlock = await this.getSQLBlock();
    const connections = this.runtime.connections;
    return Malloy.run({
      connections,
      sqlStruct: sqlBlock,
      options,
    });
  }

  async *runStream(options?: {
    rowLimit?: number;
  }): AsyncIterableIterator<DataRecord> {
    const sqlStruct = await this.getSQLBlock();
    const connections = this.runtime.connections;
    const stream = Malloy.runStream({connections, sqlStruct, options});
    for await (const row of stream) {
      yield row;
    }
  }

  /**
   * Materialize this loaded SQL block.
   *
   * @return A promise of a SQL block.
   */
  public getSQLBlock(): Promise<SQLBlockStructDef> {
    return this.materialize();
  }

  /**
   * Materialize the SQL of this loaded SQL block.
   *
   * @return A promise to the SQL string.
   */
  public async getSQL(): Promise<string> {
    const sqlStruct = await this.getSQLBlock();
    return sqlStruct.structSource.sqlBlock.selectStr;
  }

  public async estimateQueryCost(): Promise<QueryRunStats> {
    const connections = this.runtime.connections;
    const sqlStruct = await this.getSQLBlock();
    return Malloy.estimateQueryCost({connections, sqlStruct});
  }
}

/**
 * An object representing the task of loading an `Explore`, capable of
 * materializing the explore (via `getExplore()`) or extending the task to produce
 * related queries.
 */
export class ExploreMaterializer extends FluentState<Explore> {
  /**
   * Load a query contained within this loaded explore.
   *
   * @param name The name of the query to load.
   * @return A `QueryMaterializer` capable of materializing the requested query, running it,
   * or loading further related objects.
   */
  public loadQueryByName(name: string): QueryMaterializer {
    return this.makeQueryMaterializer(async () => {
      return (await this.materialize()).getQueryByName(name);
    });
  }

  /**
   * Materialize a query contained within this loaded explore.
   *
   * @param name The name of the query to materialize.
   * @return A promise to the requested prepared query.
   */
  public getQueryByName(name: string): Promise<PreparedQuery> {
    return this.loadQueryByName(name).getPreparedQuery();
  }

  /**
   * Materialize this loaded explore.
   *
   * @return A promise to the compiled `Explore`.
   */
  public getExplore(): Promise<Explore> {
    return this.materialize();
  }
}

export type ResultJSON = {
  queryResult: QueryResult;
  modelDef: ModelDef;
};

/**
 * The result of running a Malloy query.
 *
 * A `Result` is a `PreparedResult` along with the data retrieved from running the query.
 */
export class Result extends PreparedResult {
  protected inner: QueryResult;

  constructor(queryResult: QueryResult, modelDef: ModelDef) {
    super(queryResult, modelDef);
    this.inner = queryResult;
  }

  public get _queryResult(): QueryResult {
    return this.inner;
  }

  /**
   * @return The result data.
   */
  public get data(): DataArray {
    return new DataArray(this.inner.result, this.resultExplore, undefined);
  }

  public get totalRows(): number {
    return this.inner.totalRows;
  }

  public get runStats(): QueryRunStats | undefined {
    return this.inner.runStats;
  }

  public toJSON(): ResultJSON {
    return {queryResult: this.inner, modelDef: this._modelDef};
  }

  public static fromJSON({queryResult, modelDef}: ResultJSON): Result {
    return new Result(queryResult, modelDef);
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
  | DataBytes
  | DataJSON
  | DataUnsupported;

export type DataArrayOrRecord = DataArray | DataRecord;

abstract class Data<T> {
  protected _field: Field | Explore;

  constructor(field: Field | Explore) {
    this._field = field;
  }

  get field(): Field | Explore {
    return this._field;
  }

  public abstract get value(): T;

  isString(): this is DataString {
    return this instanceof DataString;
  }

  get string(): DataString {
    if (this.isString()) {
      return this;
    }
    throw new Error('Not a string.');
  }

  isBoolean(): this is DataBoolean {
    return this instanceof DataBoolean;
  }

  get boolean(): DataBoolean {
    if (this.isBoolean()) {
      return this;
    }
    throw new Error('Not a boolean.');
  }

  isNumber(): this is DataNumber {
    return this instanceof DataNumber;
  }

  get number(): DataNumber {
    if (this.isNumber()) {
      return this;
    }
    throw new Error('Not a number.');
  }

  isTimestamp(): this is DataTimestamp {
    return this instanceof DataTimestamp;
  }

  get timestamp(): DataTimestamp {
    if (this.isTimestamp()) {
      return this;
    }
    throw new Error('Not a timestamp.');
  }

  isDate(): this is DataDate {
    return this instanceof DataDate;
  }

  get date(): DataDate {
    if (this.isDate()) {
      return this;
    }
    throw new Error('Not a date.');
  }

  isNull(): this is DataNull {
    return this instanceof DataNull;
  }

  isBytes(): this is DataBytes {
    return this instanceof DataBytes;
  }

  get bytes(): DataBytes {
    if (this.isBytes()) {
      return this;
    }
    throw new Error('Not bytes.');
  }

  isRecord(): this is DataRecord {
    return this instanceof DataRecord;
  }

  get record(): DataRecord {
    if (this.isRecord()) {
      return this;
    }
    throw new Error('Not a record.');
  }

  isUnsupported(): this is DataUnsupported {
    return this instanceof DataUnsupported;
  }

  get unsupported(): DataUnsupported {
    if (this.isUnsupported()) {
      return this;
    }
    throw new Error('Not unsupported.');
  }

  isArray(): this is DataArray {
    return this instanceof DataArray;
  }

  get array(): DataArray {
    if (this.isArray()) {
      return this;
    }
    throw new Error('Not an array.');
  }

  isArrayOrRecord(): DataArrayOrRecord {
    if (this instanceof DataArray || this instanceof DataRecord) {
      return this;
    }
    throw new Error('No Array or Record');
  }
}

class ScalarData<T> extends Data<T> {
  protected _value: T;
  protected _field: AtomicField;

  constructor(value: T, field: AtomicField) {
    super(field);
    this._value = value;
    this._field = field;
  }

  public get value(): T {
    return this._value;
  }

  get field(): AtomicField {
    return this._field;
  }
}

class DataString extends ScalarData<string> {
  protected _field: StringField;

  constructor(value: string, field: StringField) {
    super(value, field);
    this._field = field;
  }

  get field(): StringField {
    return this._field;
  }
}

class DataUnsupported extends ScalarData<unknown> {
  protected _field: UnsupportedField;

  constructor(value: unknown, field: UnsupportedField) {
    super(value, field);
    this._field = field;
  }

  get field(): UnsupportedField {
    return this._field;
  }
}

class DataBoolean extends ScalarData<boolean> {
  protected _field: BooleanField;

  constructor(value: boolean, field: BooleanField) {
    super(value, field);
    this._field = field;
  }

  get field(): BooleanField {
    return this._field;
  }
}

class DataJSON extends ScalarData<string> {
  protected _field: JSONField;

  constructor(value: string, field: JSONField) {
    super(value, field);
    this._field = field;
  }

  get field(): JSONField {
    return this._field;
  }
}

class DataNumber extends ScalarData<number> {
  protected _field: NumberField;

  constructor(value: number, field: NumberField) {
    super(value, field);
    this._field = field;
  }

  get field(): NumberField {
    return this._field;
  }
}

function valueToDate(value: Date): Date {
  // TODO properly map the data from BQ/Postgres types
  if (value instanceof Date) {
    return value;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valAsAny = value as any;
  if (valAsAny.constructor.name === 'Date') {
    // For some reason duckdb TSTZ values come back as objects which do not
    // pass "instance of" but do seem date like.
    return new Date(value as Date);
  } else if (typeof value === 'number') {
    return new Date(value);
  } else if (typeof value !== 'string') {
    return new Date((value as unknown as {value: string}).value);
  } else {
    // Postgres timestamps end up here, and ideally we would know the system
    // timezone of the postgres instance to correctly create a Date() object
    // which represents the same instant in time, but we don't have the data
    // flow to implement that. This may be a problem at some future day,
    // so here is a comment, for that day.
    const parsed = DateTime.fromISO(value, {zone: 'UTC'});
    return parsed.toJSDate();
  }
}

class DataTimestamp extends ScalarData<Date> {
  protected _field: TimestampField;

  constructor(value: Date, field: TimestampField) {
    super(value, field);
    this._field = field;
  }

  public get value(): Date {
    return valueToDate(this._value);
  }

  get field(): TimestampField {
    return this._field;
  }
}

class DataDate extends ScalarData<Date> {
  protected _field: DateField;

  constructor(value: Date, field: DateField) {
    super(value, field);
    this._field = field;
  }

  public get value(): Date {
    return valueToDate(this._value);
  }

  get field(): DateField {
    return this._field;
  }
}

class DataBytes extends ScalarData<Buffer> {}

class DataNull extends Data<null> {
  public get value(): null {
    return null;
  }
}

export class DataArray extends Data<QueryData> implements Iterable<DataRecord> {
  private queryData: QueryData;
  protected _field: Explore;

  constructor(
    queryData: QueryData,
    field: Explore,
    public readonly parent: DataArrayOrRecord | undefined
  ) {
    super(field);
    this.queryData = queryData;
    this._field = field;
  }

  /**
   * @return The `Explore` that describes the structure of this data.
   */
  public get field(): Explore {
    return this._field;
  }

  /**
   * @return The raw object form of the data.
   */
  public toObject(): QueryData {
    return this.queryData;
  }

  path(...path: (number | string)[]): DataColumn {
    return getPath(this, path);
  }

  row(index: number): DataRecord {
    return new DataRecord(this.queryData[index], index, this.field, this);
  }

  get rowCount(): number {
    return this.queryData.length;
  }

  public get value(): QueryData {
    return this.toObject();
  }

  [Symbol.iterator](): Iterator<DataRecord> {
    let currentIndex = 0;
    const queryData = this.queryData;
    const getRow = (index: number) => this.row(index);
    return {
      next(): IteratorResult<DataRecord> {
        if (currentIndex < queryData.length) {
          return {value: getRow(currentIndex++), done: false};
        } else {
          return {value: undefined, done: true};
        }
      },
    };
  }

  async *inMemoryStream(): AsyncIterableIterator<DataRecord> {
    for (let i = 0; i < this.queryData.length; i++) {
      yield this.row(i);
    }
  }
}

function getPath(data: DataColumn, path: (number | string)[]): DataColumn {
  for (const segment of path) {
    if (typeof segment === 'number') {
      data = data.array.row(segment);
    } else {
      data = data.record.cell(segment);
    }
  }
  return data;
}

export class DataRecord extends Data<{[fieldName: string]: DataColumn}> {
  private queryDataRow: QueryDataRow;
  protected _field: Explore;
  public readonly index: number | undefined;

  constructor(
    queryDataRow: QueryDataRow,
    index: number | undefined,
    field: Explore,
    public readonly parent: DataArrayOrRecord | undefined
  ) {
    super(field);
    this.queryDataRow = queryDataRow;
    this._field = field;
    this.index = index;
  }

  toObject(): QueryDataRow {
    return this.queryDataRow;
  }

  path(...path: (number | string)[]): DataColumn {
    return getPath(this, path);
  }

  cell(fieldOrName: string | Field): DataColumn {
    const fieldName =
      typeof fieldOrName === 'string' ? fieldOrName : fieldOrName.name;
    const field = this._field.getFieldByName(fieldName);
    const value = this.queryDataRow[fieldName];
    if (value === null) {
      return new DataNull(field);
    }
    if (field.isAtomicField()) {
      if (field.isBoolean()) {
        return new DataBoolean(value as boolean, field);
      } else if (field.isDate()) {
        return new DataDate(value as Date, field);
      } else if (field.isJSON()) {
        return new DataJSON(value as string, field);
      } else if (field.isTimestamp()) {
        return new DataTimestamp(value as Date, field);
      } else if (field.isNumber()) {
        return new DataNumber(value as number, field);
      } else if (field.isString()) {
        return new DataString(value as string, field);
      } else if (field.isUnsupported()) {
        return new DataUnsupported(value as unknown, field);
      }
    } else if (field.isExploreField()) {
      if (Array.isArray(value)) {
        return new DataArray(value, field, this);
      } else {
        return new DataRecord(value as QueryDataRow, undefined, field, this);
      }
    }
    throw new Error(
      `Internal Error: could not construct data column for field '${fieldName}'.`
    );
  }

  public get value(): {[fieldName: string]: DataColumn} {
    throw new Error('Not implemented;');
  }

  // Non repeating values show up as DataRecords
  public get field(): Explore {
    return this._field;
  }

  // Allow iteration over non repeating values to simplify end user code.
  [Symbol.iterator](): Iterator<DataRecord> {
    let returned = false;
    const getSelf = () => {
      return this;
    };
    return {
      next(): IteratorResult<DataRecord> {
        if (!returned) {
          returned = true;
          return {
            value: getSelf(),
            done: false,
          };
        } else {
          return {value: undefined, done: true};
        }
      },
    };
  }
}

function isURLReader(
  thing:
    | URLReader
    | LookupConnection<InfoConnection>
    | LookupConnection<Connection>
    | Connection
): thing is URLReader {
  return 'readURL' in thing;
}

function isLookupConnection<T extends InfoConnection = InfoConnection>(
  thing:
    | URLReader
    | LookupConnection<InfoConnection>
    | LookupConnection<Connection>
    | Connection
): thing is LookupConnection<T> {
  return 'lookupConnection' in thing;
}

export interface WriteStream {
  write: (text: string) => void;
  close: () => void;
}

export abstract class DataWriter {
  constructor(protected readonly stream: WriteStream) {}

  abstract process(data: AsyncIterableIterator<DataRecord>): Promise<void>;
}

export class JSONWriter extends DataWriter {
  async process(data: AsyncIterableIterator<DataRecord>): Promise<void> {
    this.stream.write('[\n');
    for await (const row of data) {
      if (row.index !== undefined && row.index > 0) {
        this.stream.write(',\n');
      }
      const json = JSON.stringify(row.toObject(), null, 2);
      const jsonLines = json.split('\n');
      for (let i = 0; i < jsonLines.length; i++) {
        const line = jsonLines[i];
        this.stream.write(`  ${line}`);
        if (i < jsonLines.length - 1) {
          this.stream.write('\n');
        }
      }
    }
    this.stream.write('\n]\n');
    this.stream.close();
  }
}

export class CSVWriter extends DataWriter {
  private readonly columnSeparator = ',';
  private readonly rowSeparator = '\n';
  private readonly quoteCharacter = '"';
  private readonly includeHeader = true;

  private escape(value: string) {
    const hasInnerQuote = value.includes(this.quoteCharacter);
    const hasInnerCommas = value.includes(this.columnSeparator);
    const hasNewline = value.includes(this.rowSeparator);
    const needsQuoting = hasInnerCommas || hasInnerQuote || hasNewline;
    if (hasInnerQuote) {
      value = value.replace(
        new RegExp(this.quoteCharacter, 'g'),
        this.quoteCharacter + this.quoteCharacter
      );
    }

    if (needsQuoting) {
      value = this.quoteCharacter + value + this.quoteCharacter;
    }

    return value;
  }

  private stringify(cell: DataColumn) {
    if (cell.isNull()) {
      return '';
    } else if (
      cell.isArray() ||
      cell.isRecord() ||
      cell.isBoolean() ||
      cell.isNumber()
    ) {
      return JSON.stringify(cell.value);
    } else if (cell.isDate() || cell.isTimestamp()) {
      return cell.value.toISOString();
    } else if (cell.isString()) {
      return cell.value;
    } else {
      return `${cell.value}`;
    }
  }

  async process(data: AsyncIterableIterator<DataRecord>): Promise<void> {
    let fields;
    for await (const row of data) {
      if (fields === undefined) {
        fields = row.field.allFields;
        if (this.includeHeader) {
          for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
            const field = fields[fieldIndex];
            this.stream.write(this.escape(field.name));
            if (fieldIndex !== fields.length - 1) {
              this.stream.write(this.columnSeparator);
            }
          }
          this.stream.write(this.rowSeparator);
        }
      }
      for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
        const field = fields[fieldIndex];
        this.stream.write(this.escape(this.stringify(row.cell(field))));
        if (fieldIndex !== fields.length - 1) {
          this.stream.write(this.columnSeparator);
        }
      }
      this.stream.write(this.rowSeparator);
    }
    this.stream.close();
  }
}
