/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  ArrayLiteralNode,
  AtomicTypeDef,
  BasicAtomicTypeDef,
  OrderBy,
  RecordLiteralNode,
} from '../../model/malloy_types';
import {activeName, isAtomic, safeRecordGet} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandBlueprintMap, expandOverrideMap} from '../functions';
import type {CompiledOrderBy, DialectFieldList} from '../dialect';
import {turtleGroupSetCondition} from '../dialect';
import {TrinoDialect} from '../trino/trino';
import {ATHENA_DIALECT_FUNCTIONS} from './dialect_functions';
import {ATHENA_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

/**
 * Athena engine version 3 is Trino behind the AWS API, and that API returns
 * every value as text: a compound value in Presto's `{a=1, b=x}` form, which
 * nothing parses back. So on Athena a Malloy record or array is carried as
 * JSON: built with CAST(... AS JSON) where the Trino base leaves a typed ROW
 * or ARRAY, and cast back to its ROW type at the one place a later stage
 * reads into it, UNNEST. JSON carries a timestamp, date or zoned timestamp
 * only as text and casts back to none of them, so inside that cast those
 * fields are declared VARCHAR and re-typed by a transform lambda; a zoned
 * timestamp is spelled by to_iso8601 on the way in, since it does not cast
 * to JSON at all.
 */
export class AthenaDialect extends TrinoDialect {
  name = 'athena';
  experimental = true;
  // The parser rejects QUALIFY at submission.
  supportsQualify = false;
  // The later stages of a pipelined nest run as a correlated subquery over
  // the first stage's array, which Athena rejects ("Given correlated
  // subquery is not supported").
  supportsPipelinesInViews = false;
  // A table's own row and array columns arrive as Presto text, which nothing
  // reads back; only a record or array the dialect built is JSON.
  readsNestedData = false;
  supportsArraysInData = false;
  // bigint arrives as exact digits and is read into a JS number.
  supportsBigIntPrecision = false;

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(ATHENA_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(ATHENA_DIALECT_FUNCTIONS);
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    // information_schema and EXPLAIN spell the 32-bit float `real`.
    if (sqlType.toLowerCase() === 'real') {
      return {type: 'number', numberType: 'float'};
    }
    return super.sqlTypeToMalloyType(sqlType);
  }

  // A record or array is a JSON value on Athena (see the class comment), so
  // a row that holds one declares the field JSON.
  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'record' || malloyType.type === 'array') {
      return 'JSON';
    }
    return super.malloyTypeToSQLType(malloyType);
  }

  /**
   * A typed ROW built to be cast to JSON. A zoned timestamp does not cast to
   * JSON, so it goes in as its ISO 8601 text.
   */
  private sqlJsonRow(fieldList: DialectFieldList, values?: string[]): string {
    const exprs = fieldList.map((f, i) => {
      const value = values ? values[i] : f.sqlExpression;
      return f.typeDef.type === 'timestamptz' ? `to_iso8601(${value})` : value;
    });
    const defs = fieldList.map(
      f =>
        `${this.sqlQuoteIdentifier(f.rawName)} ` +
        (f.typeDef.type === 'timestamptz'
          ? 'VARCHAR'
          : this.malloyTypeToSQLType(f.typeDef))
    );
    return `CAST(ROW(${exprs.join(',\n ')}) AS ROW(${defs.join(', \n')}))`;
  }

  sqlAggregateTurtle(
    groupSet: number | undefined,
    fieldList: DialectFieldList,
    orderBy: CompiledOrderBy[] | undefined,
    limit?: number,
    filterSQL?: string
  ): string {
    const orderByClause = orderBy ? this.sqlTurtleOrderByClause(orderBy) : '';
    const cond = turtleGroupSetCondition(groupSet, filterSQL);
    const filterClause = cond ? ` FILTER (WHERE ${cond})` : '';
    const arrayAgg = `ARRAY_AGG(${this.sqlJsonRow(fieldList)} ${orderByClause})${filterClause}`;
    // SLICE(array, start, length) is 1-based; length n keeps the first n.
    const rows =
      limit !== undefined ? `SLICE(${arrayAgg}, 1, ${limit})` : arrayAgg;
    // ARRAY_AGG over no rows is NULL; a nest with no rows is an empty array.
    return `COALESCE(CAST(${rows} AS JSON), JSON '[]')`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    return `CAST(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${this.sqlJsonRow(fieldList)} END) AS JSON)`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const nulls = fieldList.map(() => 'NULL');
    return `CAST(COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${this.sqlJsonRow(fieldList)} END), ${this.sqlJsonRow(fieldList, nulls)}) AS JSON)`;
  }

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    fieldList: DialectFieldList,
    orderBy: OrderBy[] | undefined
  ): string {
    const o = this.sqlCombineLastStageOrderBy(orderBy, fieldList);
    return `SELECT COALESCE(CAST(ARRAY_AGG(${this.sqlJsonRow(fieldList)}${o}) AS JSON), JSON '[]') FROM ${lastStageName}\n`;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const fieldList: DialectFieldList = [];
    for (const f of lit.typeDef.fields) {
      if (isAtomic(f)) {
        const name = activeName(f);
        fieldList.push({
          typeDef: f,
          rawName: name,
          sqlExpression:
            safeRecordGet(lit.kids, name)?.sql ??
            'internal-error-record-literal',
        });
      }
    }
    return `CAST(${this.sqlJsonRow(fieldList)} AS JSON)`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    return `CAST(${super.sqlLiteralArray(lit)} AS JSON)`;
  }

  /**
   * How a field of a JSON-carried row is declared in the cast back to a ROW,
   * and the expression that restores its type afterwards. JSON casts to a
   * ROW with fields of every scalar type but the time types.
   */
  private jsonCarriedField(typeDef: AtomicTypeDef): {
    carried: string;
    retype?: (sql: string) => string;
  } {
    switch (typeDef.type) {
      case 'timestamp':
        return {carried: 'VARCHAR', retype: sql => `CAST(${sql} AS TIMESTAMP)`};
      case 'date':
        return {carried: 'VARCHAR', retype: sql => `CAST(${sql} AS DATE)`};
      case 'timestamptz':
        return {
          carried: 'VARCHAR',
          retype: sql => `from_iso8601_timestamp(${sql})`,
        };
      default:
        return {carried: this.malloyTypeToSQLType(typeDef)};
    }
  }

  /**
   * `source` as an ARRAY of its declared type, ready to UNNEST. A source this
   * dialect built is JSON; a native array casts to its own type unchanged,
   * so one clause reads both.
   */
  private sqlTypedArray(
    source: string,
    fieldList: DialectFieldList,
    isArray: boolean
  ): string {
    const q = (name: string) => this.sqlQuoteIdentifier(name);
    if (isArray) {
      if (fieldList.length === 0) {
        return source;
      }
      const {carried, retype} = this.jsonCarriedField(fieldList[0].typeDef);
      const array = `CAST(${source} AS ARRAY(${carried}))`;
      return retype ? `transform(${array}, __v -> ${retype('__v')})` : array;
    }
    const carried = fieldList.map(f => ({
      f,
      ...this.jsonCarriedField(f.typeDef),
    }));
    const array = `CAST(${source} AS ARRAY(ROW(${carried
      .map(c => `${q(c.f.rawName)} ${c.carried}`)
      .join(', ')})))`;
    if (!carried.some(c => c.retype)) {
      return array;
    }
    const values = carried.map(c => {
      const value = `__r.${q(c.f.rawName)}`;
      return c.retype ? c.retype(value) : value;
    });
    const defs = carried.map(
      c => `${q(c.f.rawName)} ${this.malloyTypeToSQLType(c.f.typeDef)}`
    );
    return `transform(${array}, __r -> CAST(ROW(${values.join(', ')}) AS ROW(${defs.join(', ')})))`;
  }

  // UNNEST of an array of rows yields the row as one column (Presto's legacy
  // shape), so the row is aliased whole and its fields read as alias.field;
  // a NULL array left-joins as one row of NULLs.
  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    const typed = this.sqlTypedArray(source, fieldList, isArray);
    const ordinality = needDistinctKey ? ' WITH ORDINALITY' : '';
    const rowId = needDistinctKey ? `, __row_id_from_${alias}` : '';
    return isArray
      ? `LEFT JOIN UNNEST(${typed})${ordinality} AS ${alias}(value${rowId}) ON TRUE`
      : `LEFT JOIN UNNEST(${typed})${ordinality} AS ${alias}_outer(${alias}${rowId}) ON TRUE`;
  }

  // The next stage reads the head as a table of the row's fields. The row
  // column of a legacy UNNEST is projected field by field: `__r.*` does not
  // expand a row on Athena.
  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string,
    fieldList?: DialectFieldList
  ): string {
    if (fieldList === undefined) {
      return super.sqlUnnestPipelineHead(isSingleton, sourceSQLExpression);
    }
    const array = isSingleton
      ? `ARRAY[${sourceSQLExpression}]`
      : sourceSQLExpression;
    const columns = fieldList
      .map(f => {
        const name = this.sqlQuoteIdentifier(f.rawName);
        return `__r.${name} AS ${name}`;
      })
      .join(', ');
    return `(SELECT ${columns} FROM UNNEST(${this.sqlTypedArray(array, fieldList, false)}) AS __t(__r))`;
  }
}
