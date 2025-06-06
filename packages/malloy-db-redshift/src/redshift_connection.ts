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

// LTNOTE: we need this extension to be installed to correctly index
//  postgres data...  We should probably do this on connection creation...
//
//     create extension if not exists tsm_system_rows
//

import * as crypto from 'crypto';
import {
  Connection,
  ConnectionConfig,
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  RedshiftDialect,
  QueryData,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLSourceDef,
  TableSourceDef,
  StreamingConnection,
  StructDef,
  FieldDef,
  ArrayDef,
  Expr,
} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';

import {Pool, types} from 'pg';
// Override parser for 64-bit integers (OID 20) and standard integers (OID 23)
types.setTypeParser(20, val => parseInt(val, 10));
types.setTypeParser(23, val => parseInt(val, 10));
import {randomUUID} from 'crypto';
interface RedshiftConnectionConfiguration {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  schema?: string;
}

type RedshiftConnectionConfigurationReader = RedshiftConnectionConfiguration;

export interface RedshiftConnectionOptions
  extends ConnectionConfig,
    RedshiftConnectionConfiguration {}

export class RedshiftConnection
  extends BaseConnection
  implements Connection, StreamingConnection, PersistSQLResults
{
  public readonly name: string;
  private config: RedshiftConnectionConfigurationReader = {};
  private readonly dialect = new RedshiftDialect();
  private pool: Pool;
  constructor(
    name: string,
    configReader?: RedshiftConnectionConfigurationReader,
    queryOptionsReader?: QueryOptionsReader
  );
  constructor(
    name: string,
    configReader?: RedshiftConnectionConfigurationReader,
    queryOptionsReader?: QueryOptionsReader
  ) {
    super();
    this.name = name;
    if (configReader) {
      this.config = configReader;
    }

    // Synchronously get config
    let config;
    if (this.config instanceof Function) {
      config = this.config();
    } else {
      config = this.config;
    }

    const {
      username: user,
      password,
      databaseName: database,
      port,
      host,
    } = config;

    this.pool = new Pool({
      user,
      password,
      database,
      port,
      host,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  protected async readConfig(): Promise<RedshiftConnectionConfiguration> {
    if (this.config instanceof Function) {
      return this.config();
    } else {
      return this.config;
    }
  }

  get dialectName(): string {
    return 'redshift';
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  public get supportsNesting(): boolean {
    return true;
  }

  async fetchSelectSchema(
    sqlRef: SQLSourceDef
  ): Promise<SQLSourceDef | string> {
    const structDef: SQLSourceDef = {...sqlRef, fields: []};
    const tempTableName = `tmp${randomUUID()}`.replace(/-/g, '');
    const basicSchemaQuery = `DROP TABLE IF EXISTS ${tempTableName};
      CREATE TEMP TABLE ${tempTableName} AS ${sqlRef.selectStr};
      SELECT "column" as "column_name", type as "data_type", null as "comment"
      FROM pg_table_def
      WHERE tablename = '${tempTableName}';
      `;
    try {
      await this.runQueriesForSchema(
        basicSchemaQuery,
        structDef,
        tempTableName
      );
    } catch (error) {
      const queries = basicSchemaQuery;
      return `Error fetching SELECT schema for \n ${queries}: \n ${error}`;
    }
    return structDef;
  }

  private determineRedshiftSQLType(v: unknown): string {
    if (typeof v === 'number') {
      return 'decimal';
    } else if (typeof v === 'boolean') {
      return 'boolean';
    } else if (typeof v === 'string') {
      const timestamp = Date.parse(v);
      return !isNaN(timestamp) && isNaN(Number(v)) ? 'timestamptz' : 'varchar';
    } else {
      return 'varchar'; // fallback for null or other non-primitive/non-object/non-array
    }
  }

  // Updates the inputted path into the path-to-dataType map.
  // Uses the inputted dataType if provided, else figures out the dataType.
  // Returns false if the path has ambiguous types, indicating that
  // we shouldn't recursively proceed with the current path
  private updatePathType(
    path: string,
    value: unknown,
    pathToType: Map<string, string>,
    pathsWithAmbiguousTypes: Set<string>,
    explicitType?: 'object' | 'array'
  ): boolean {
    // If path is already known to be mixed, do nothing further and signal not to continue
    if (pathsWithAmbiguousTypes.has(path)) {
      return false;
    }

    // use explicit type if provided, else figure out the type
    const newType = explicitType
      ? explicitType
      : this.determineRedshiftSQLType(value);

    // prevents a path from being locked into the 'string' type
    // if the first value seen is null
    const isNullFallback =
      !explicitType && newType === 'varchar' && value === null;

    // Path seen before. Check if the type is different.
    if (pathToType.has(path)) {
      const existingType = pathToType.get(path);
      // Conflict if types differ, and the new type isn't just a null fallback
      if (existingType !== newType && !isNullFallback) {
        // Mixed types detected - remove the path and mark as mixed.
        pathToType.delete(path);
        pathsWithAmbiguousTypes.add(path);
        return false; // Became ambiguous, return false
      }
    } else if (!isNullFallback) {
      // Path not seen before. Set the type, unless it's a null fallback.
      pathToType.set(path, newType);
    }
    return true; // Not ambiguous, return true
  }

  private async runQueriesForSchema(
    basicSchemaQuery: string,
    structDef: StructDef,
    tablePath: string
  ): Promise<void> {
    // Populate basic fields and identify super columns by calling the updated function
    const superCols = await this.runBasicSchemaQuery(
      basicSchemaQuery,
      structDef,
      tablePath
    );

    if (superCols.length > 0) {
      await this.runSuperColsSchemaQuery(superCols, structDef, tablePath);
    }
  }

  private async runBasicSchemaQuery(
    basicSchemaQuery: string,
    structDef: StructDef,
    tablePath: string
  ): Promise<string[]> {
    const {rows, totalRows} = await this.runSQL(basicSchemaQuery);
    if (!totalRows) {
      throw new Error(`Unable to read schema for table ${tablePath}.`);
    }

    const superCols: string[] = [];
    for (const row of rows) {
      const redshiftDataType = row['data_type'] as string;
      const name = row['column_name'] as string;

      if (redshiftDataType === 'super') {
        // we'll process these later
        superCols.push(name);
      } else {
        // add information directly to structDef
        const malloyType = this.dialect.sqlTypeToMalloyType(redshiftDataType);
        structDef.fields.push({...malloyType, name});
      }
    }
    return superCols;
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef | string> {
    const structDef: StructDef = {
      type: 'table',
      name: tableKey,
      dialect: 'redshift',
      tablePath,
      connection: this.name,
      fields: [],
    };
    const [schema, table] = tablePath.split('.');
    if (table === undefined) {
      return 'Default schema not yet supported in Redshift';
    }
    const basicSchemaQuery = `SELECT "column_name", "data_type", "remarks" as "comment"
       FROM svv_columns
       WHERE table_schema = '${schema}'
       AND table_name = '${table}';`;

    try {
      await this.runQueriesForSchema(basicSchemaQuery, structDef, tablePath);
    } catch (error) {
      return `Error fetching TABLE schema for ${tablePath}: ${error}`;
    }
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runSQL('SELECT 1');
  }

  protected async runRedshiftQuery(
    sql: string | string[],
    _pageSize: number,
    _rowIndex: number,
    deJSON: boolean
  ): Promise<MalloyQueryData> {
    const sqlArray = this.config.schema
      ? [`SET search_path TO ${this.config.schema};`]
      : [];
    // redshift turns camelcase into all lowercase
    // this doesn't actually matter for prod,
    // but index and temp table tests do expect the original case
    sqlArray.push('SET enable_case_sensitive_identifier TO true;');
    if (Array.isArray(sql)) {
      sqlArray.push(...sql);
    } else {
      sqlArray.push(sql);
    }

    let client;
    try {
      // get client from pool
      client = await this.pool.connect();

      let result;
      for (const sqlStatement of sqlArray) {
        result = await client.query(sqlStatement);
      }
      if (Array.isArray(result)) {
        result = result.pop();
      }
      if (result?.rows) {
        result.rows = result.rows.map(row => {
          const newRow = {...row};
          Object.keys(newRow).forEach((key, index) => {
            if (key === '?column?') {
              newRow[index + 1] = newRow[key];
              delete newRow[key];
            }
          });
          return newRow;
        });
      }

      return {
        rows: result.rows as QueryData,
        totalRows: result.rows.length,
      };
    } catch (error) {
      throw new Error(`Error executing query: ${error}`);
    } finally {
      if (client) client.release();
    }
  }

  public async runSQL(
    sql: string | string[],
    {rowLimit}: RunSQLOptions = {},
    _rowIndex = 0
  ): Promise<MalloyQueryData> {
    const result = await this.runRedshiftQuery(sql, 100000, 0, true);
    return result;
  }

  public async *runSQLStream(
    sqlCommand: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const result = await this.runSQL(sqlCommand, {rowLimit});
    for (const row of result.rows) {
      if (abortSignal?.aborted) break;
      yield row;
    }
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = crypto.createHash('md5').update(sqlCommand).digest('hex');
    const tableName = `tt${hash}`;

    const cmd = [
      `DROP TABLE IF EXISTS ${tableName};`,
      `CREATE TEMP TABLE ${tableName} AS ${sqlCommand};`,
    ];
    await this.runSQL(cmd);
    return tableName;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    return;
  }

  // traverse the current superJson and fill out pathToType map
  private processNestedJson(
    // super value can be object, array, or primitive data type
    superValue: Record<string, unknown> | unknown[] | unknown | null,
    currentPath: string,
    pathToType: Map<string, string>,
    pathsWithAmbiguousTypes: Set<string>
  ): void {
    if (superValue === null) {
      return;
      // handle object
    } else if (typeof superValue === 'object' && !Array.isArray(superValue)) {
      // track current path as an object
      const shouldProceed = this.updatePathType(
        currentPath,
        superValue,
        pathToType,
        pathsWithAmbiguousTypes,
        'object'
      );
      if (!shouldProceed) {
        return;
      }
      // recurse for each key value pair in object
      for (const [key, value] of Object.entries(superValue)) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        this.processNestedJson(
          value,
          path,
          pathToType,
          pathsWithAmbiguousTypes
        );
      }
    }
    // Handle array
    else if (Array.isArray(superValue)) {
      // Track current path as an array
      const shouldProceed = this.updatePathType(
        currentPath,
        superValue,
        pathToType,
        pathsWithAmbiguousTypes,
        'array'
      );
      if (!shouldProceed) {
        return;
      }

      const arrayElementPath = `${currentPath}[*]`;

      // recurse for each element in array
      for (const element of superValue) {
        this.processNestedJson(
          element,
          arrayElementPath,
          pathToType,
          pathsWithAmbiguousTypes
        );
      }
    }
    // Handle leaf node (primitive or null)
    else {
      this.updatePathType(
        currentPath,
        superValue,
        pathToType,
        pathsWithAmbiguousTypes
      );
    }
  }

  // Recursively add fields to the structDef
  private addFieldToStructDef(
    parentFields: FieldDef[],
    path: string[],
    fieldType: string
  ): void {
    if (path.length === 0) return;

    const currentPathSegment = path[0];
    const remainingPath = path.slice(1);

    let fieldName = currentPathSegment;
    // case we're processing the children of an array
    let isArrayElement = false;
    if (currentPathSegment.endsWith('[*]')) {
      fieldName = currentPathSegment.slice(0, -3);
      isArrayElement = true;
    }

    // Determine if current FieldDef[] contains a definition for the current path
    let field: FieldDef | undefined = parentFields.find(
      f => f.name === fieldName
    );

    // Create new FieldDef if it doesn't exist
    // if the currentPathSegement is an array element, this would be its parent array
    if (!field) {
      field = this.getFieldDef(fieldName, fieldType);
      parentFields.push(field);
    }

    // for scalar arrays, we need to add extra info for .each operator to work
    if (
      isArrayElement &&
      fieldType !== 'object' &&
      path.length == 1 &&
      // Ensures current field is specifically an ArrayDef
      field &&
      field.type === 'array'
    ) {
      this.handleScalarArrayElementPopulation(field as ArrayDef, fieldType);
    }

    // recursively update the remaining path segments into the structDef
    if (path.length > 1 && 'fields' in field) {
      this.addFieldToStructDef(field.fields, remainingPath, fieldType);
    }
  }

  private handleScalarArrayElementPopulation(
    arrayField: ArrayDef,
    elementType: string
  ): void {
    // the following is needed for malloy's .each notation to access array elements
    arrayField.elementTypeDef = this.dialect.sqlTypeToMalloyType(elementType);
    const arrayElem = this.getFieldDef('value', elementType);
    const eachField = {
      ...arrayElem,
      name: 'each',
      e: {node: 'field', path: ['value']} as Expr,
    };
    arrayField.fields.push(arrayElem);
    arrayField.fields.push(eachField as FieldDef);
  }

  private getFieldDef(fieldName: string, fieldType: string): FieldDef {
    if (fieldType === 'object') {
      return {
        type: 'record',
        name: fieldName,
        fields: [],
        join: 'one',
      };
    } else if (fieldType === 'array') {
      return {
        type: 'array',
        join: 'many',
        name: fieldName,
        elementTypeDef: {type: 'record_element'},
        fields: [],
      };
      // leaf node - use the actual type
    } else {
      return {
        ...this.dialect.sqlTypeToMalloyType(fieldType),
        name: fieldName,
      };
    }
  }

  /**
   * Creates a map of paths to their data types by parsing JSON from super columns.
   *
   * example resulting pathToType map:
   * Map(6) {
   *   'reviews_json.timestamp' => 'decimal',
   *   'reviews_json.reviews' => 'array',
   *   'reviews_json.reviews[*].question_id' => 'decimal',
   *   'reviews_json.reviews[*].label' => 'varchar',
   *   'reviews_json.reviews[*].other_option' => 'varchar',
   *   'reviews_json.foo.bar' => 'varchar'
   * }
   *
   * @param rows the rows to parse
   * @param superCols the columns of type 'super' to parse
   * @returns a map of paths to their data types
   */
  private createPathToTypeMap(
    rows: Record<string, unknown>[],
    superCols: string[]
  ): Map<string, string> {
    const pathToType = new Map<string, string>();
    const pathsWithAmbiguousTypes = new Set<string>();

    // process all super columns and update pathToType map
    for (const row of rows) {
      for (const [key, value] of Object.entries(row)) {
        if (superCols.includes(key) && typeof value === 'string') {
          try {
            const jsonValue = JSON.parse(value);
            if (jsonValue !== null) {
              this.processNestedJson(
                jsonValue,
                key,
                pathToType,
                pathsWithAmbiguousTypes
              );
            }
          } catch (e) {
            continue; // Ignore JSON parsing errors
          }
        }
      }
    }

    return pathToType;
  }

  /**
   * Samples JSON data from super columns in a Redshift table to infer their schema structure.
   * For each super column, it queries a sample of rows, parses the JSON, and builds a map of
   * paths to their data types. These paths and types are then added to the main structDef.
   *
   * @param superCols the columns of type 'super' to sample
   * @param structDef the struct that fetchTableSchema returns
   * @param tablePath the table to query
   */
  private async runSuperColsSchemaQuery(
    superCols: string[],
    structDef: StructDef,
    tablePath: string
  ): Promise<void> {
    // query to sample the jsons in the super columns
    // WHERE clause is needed because Redshift
    // type varchar (string) cannot hold more than 65535 bytes
    const sampleQuery = `
        SELECT ${superCols.map(s => `JSON_SERIALIZE(${s}) as ${s}`).join(',')}
        FROM ${tablePath}
        WHERE
          ${superCols
            .map(col => `JSON_SIZE(${col}) < 65535`)
            .join('\n          AND ')}
        LIMIT 100;
      `;

    const {rows, totalRows} = await this.runSQL(sampleQuery); // Apply formatting
    const pathToType = this.createPathToTypeMap(rows, superCols);

    // Add each path to type pair into the structDef
    for (const [path, type] of pathToType.entries()) {
      const pathSegments = path.split('.');
      this.addFieldToStructDef(structDef.fields, pathSegments, type);
    }
  }
}
