/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AtomicTypeDef,
  PersistSQLResults,
  QueryOptionsReader,
  StructDef,
  TableSourceDef,
} from '@malloydata/malloy';
import {AthenaDialect, makeDigest, mkFieldDef} from '@malloydata/malloy';
import {TrinoPrestoConnection} from '@malloydata/db-trino';
import type {
  AthenaCommandSender,
  AthenaConnectionConfiguration,
} from './athena_runner';
import {AthenaRunner} from './athena_runner';
import {
  informationSchemaColumnsSQL,
  schemaFromTrinoExplain,
} from './athena_schema';

/**
 * Athena engine version 3 is Trino reached through the AWS API, so the
 * connection is the shared Trino/Presto connection over an AthenaRunner.
 * What differs is where the schema comes from: GetQueryResults types a
 * compound column only as `row` or `array`, and DESCRIBE answers in Hive's
 * spelling, so a table's columns come from information_schema.columns and a
 * SELECT's from its EXPLAIN plan.
 */
export class AthenaConnection extends TrinoPrestoConnection {
  protected override readonly dialect = new AthenaDialect();
  private readonly runner: AthenaRunner;
  private readonly config: AthenaConnectionConfiguration;

  constructor(
    name: string,
    config: AthenaConnectionConfiguration = {},
    queryOptions?: QueryOptionsReader,
    client?: AthenaCommandSender
  ) {
    const runner = new AthenaRunner(config, client);
    super(name, runner, queryOptions);
    this.runner = runner;
    this.config = config;
  }

  override get dialectName(): string {
    return 'athena';
  }

  public override getDigest(): string {
    const {
      region,
      workGroup,
      catalog,
      database,
      outputLocation,
      accessKeyId,
      resultReuseMaxAgeMinutes,
    } = this.config;
    // The identity is part of what a statement can see, and result reuse
    // decides how stale an answer may be.
    return makeDigest(
      'athena',
      region,
      workGroup,
      catalog,
      database,
      outputLocation,
      accessKeyId,
      resultReuseMaxAgeMinutes !== undefined
        ? String(resultReuseMaxAgeMinutes)
        : undefined
    );
  }

  // Writes are CTAS and UNLOAD to S3; there is no temporary table.
  public override canPersist(): this is PersistSQLResults {
    return false;
  }

  public override malloyTypeFromTrinoType(trinoType: string): AtomicTypeDef {
    const bare = trinoType.toLowerCase();
    // A compound column arrives as Presto's text (`{a=1, b=x}`), which
    // nothing reads back, so it is opaque whether the schema spells its
    // contents (`row(a integer)`) or GetQueryResults leaves them off
    // (`row`). Nests the dialect builds travel as JSON and never come
    // through here typed. `float` is the results API's spelling of `real`.
    if (/^(row|array|map)\b/.test(bare)) {
      return {type: 'sql native', rawType: trinoType};
    }
    if (bare === 'float') {
      return {type: 'number', numberType: 'float'};
    }
    return super.malloyTypeFromTrinoType(trinoType);
  }

  // The Trino base types this method's result as a StructDef, so an expected
  // failure is thrown here and the schema cache reports its message as the
  // error string.
  override async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const query = informationSchemaColumnsSQL(tablePath, this.config.database);
    if ('error' in query) {
      throw new Error(query.error);
    }
    const result = await this.runner.runSQL(query.sql);
    if (result.error) {
      throw new Error(result.error);
    }
    if (result.rows.length === 0) {
      throw new Error(`Table '${tablePath}' does not exist`);
    }
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableKey,
      dialect: this.dialectName,
      tablePath,
      connection: this.name,
      fields: [],
    };
    this.structDefFromSchema(result.rows as string[][], structDef);
    return structDef;
  }

  protected async fillStructDefForSqlBlockSchema(
    sql: string,
    structDef: StructDef
  ): Promise<void> {
    const result = await this.runner.runSQL(`EXPLAIN ${sql}`);
    if (result.error) {
      throw new Error(result.error);
    }
    const planLines = result.rows.map(row => String(row[0] ?? ''));
    for (const {name, type} of schemaFromTrinoExplain(planLines)) {
      structDef.fields.push(
        mkFieldDef(this.malloyTypeFromTrinoType(type), name)
      );
    }
  }

  // Engine version 2 is Presto 0.217, whose SQL the Trino dialect does not
  // target. Athena has no version() function; every execution reports the
  // engine that ran it.
  public override async test(): Promise<void> {
    await this.runSQL('SELECT 1');
    const engine =
      this.runner.lastExecution?.EngineVersion?.EffectiveEngineVersion;
    if (engine !== undefined && !/version 3\b/.test(engine)) {
      throw new Error(
        `Workgroup runs "${engine}"; this connection needs Athena engine version 3`
      );
    }
  }
}
