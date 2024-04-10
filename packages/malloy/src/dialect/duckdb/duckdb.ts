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

import {
  DateUnit,
  Expr,
  ExtractUnit,
  Sampling,
  TimeFieldType,
  TimeValue,
  TimestampUnit,
  TypecastFragment,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  mkExpr,
  FieldAtomicTypeDef,
} from '../../model/malloy_types';
import {indent} from '../../model/utils';
import {DialectFunctionOverloadDef} from '../functions';
import {DUCKDB_FUNCTIONS} from './functions';
import {Dialect, DialectFieldList, QueryInfo, inDays, qtz} from '../dialect';

// need to refactor runSQL to take a SQLBlock instead of just a sql string.
const hackSplitComment = '-- hack: split on this';

const pgExtractionMap: Record<string, string> = {
  'day_of_week': 'dow',
  'day_of_year': 'doy',
};

const duckDBToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
  'BIGINT': {type: 'number', numberType: 'integer'},
  'INTEGER': {type: 'number', numberType: 'integer'},
  'TINYINT': {type: 'number', numberType: 'integer'},
  'SMALLINT': {type: 'number', numberType: 'integer'},
  'UBIGINT': {type: 'number', numberType: 'integer'},
  'UINTEGER': {type: 'number', numberType: 'integer'},
  'UTINYINT': {type: 'number', numberType: 'integer'},
  'USMALLINT': {type: 'number', numberType: 'integer'},
  'HUGEINT': {type: 'number', numberType: 'integer'},
  'DOUBLE': {type: 'number', numberType: 'float'},
  'FLOAT': {type: 'number', numberType: 'float'},
  'VARCHAR': {type: 'string'},
  'DATE': {type: 'date'},
  'TIMESTAMP': {type: 'timestamp'},
  'TIME': {type: 'string'},
  'DECIMAL': {type: 'number', numberType: 'float'},
  'BOOLEAN': {type: 'boolean'},
};

export class DuckDBDialect extends Dialect {
  name = 'duckdb';
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'NUMERIC';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = true;
  supportsAggDistinct = true;
  supportsCTEinCoorelatedSubQueries = true;
  dontUnionIndex = true;
  supportsQualify = true;
  supportsSafeCast = true;
  supportsNesting = true;

  // hack until they support temporary macros.
  get udfPrefix(): string {
    return `__udf${Math.floor(Math.random() * 100000)}`;
  }

  quoteTablePath(tableName: string): string {
    return tableName.match(/[/*:]/) ? `'${tableName}'` : tableName;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0,${groupSetCount},1)) as group_set  ) as group_set`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `FIRST(${fieldName}) FILTER (WHERE ${fieldName} IS NOT NULL)`;
  }

  mapFields(fieldList: DialectFieldList): string {
    return fieldList.join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    let tail = '';
    if (limit !== undefined) {
      tail += `[1:${limit}]`;
    }
    const fields = fieldList
      .map(f => `\n  ${f.sqlOutputName}: ${f.sqlExpression}`)
      .join(', ');
    return `COALESCE(LIST({${fields}} ${orderBy}) FILTER (WHERE group_set=${groupSet})${tail},[])`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT_PACK(${fields}))`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `MAX(CASE WHEN group_set=${groupSet} THEN ${name} END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList
      .map(f => `${f.sqlOutputName}: ${f.sqlExpression} `)
      .join(', ');
    const nullValues = fieldList
      .map(f => `${f.sqlOutputName}: NULL`)
      .join(', ');

    return `COALESCE(FIRST({${fields}}) FILTER(WHERE group_set=${groupSet}), {${nullValues}})`;
  }

  // sqlUnnestAlias(
  //   source: string,
  //   alias: string,
  //   _fieldList: DialectFieldList,
  //   _needDistinctKey: boolean
  // ): string {
  //   return `LEFT JOIN (select UNNEST(generate_series(1,
  //       100000, --
  //       -- (SELECT genres_length FROM movies limit 1),
  //       1)) as __row_id) as ${alias} ON  ${alias}.__row_id <= array_length(${source})`;
  //   // When DuckDB supports lateral joins...
  //   //return `,(select UNNEST(generate_series(1, length(${source}),1))) as ${alias}(__row_id)`;
  // }

  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    needDistinctKey: boolean,
    _isArray: boolean,
    isInNestedPipeline: boolean
  ): string {
    if (this.unnestWithNumbers) {
      // Duckdb can't unnest in a coorelated subquery at the moment so we hack it.
      const arrayLen = isInNestedPipeline
        ? '100000'
        : `array_length(${source})`;
      return `LEFT JOIN (select UNNEST(generate_series(1,
        ${arrayLen},
        1)) as __row_id) as ${alias} ON  ${alias}.__row_id <= array_length(${source})`;
    }
    //Simulate left joins by guarenteeing there is at least one row.
    if (!needDistinctKey) {
      return `LEFT JOIN LATERAL (SELECT UNNEST(${source}), 1 as ignoreme) as ${alias}_outer(${alias},ignoreme) ON ${alias}_outer.ignoreme=1`;
    } else {
      return `LEFT JOIN LATERAL (SELECT UNNEST(GENERATE_SERIES(1, length(${source}),1)) as __row_id, UNNEST(${source}), 1 as ignoreme) as ${alias}_outer(__row_id, ${alias},ignoreme) ON  ${alias}_outer.ignoreme=1`;
    }
  }

  sqlSumDistinctHashedKey(_sqlDistinctKey: string): string {
    return 'uses sumDistinctFunction, should not be called';
  }

  sqlGenerateUUID(): string {
    return 'GEN_RANDOM_UUID()';
  }

  sqlDateToString(sqlDateExp: string): string {
    return `(${sqlDateExp})::date::varchar`;
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean,
    isArray: boolean
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (!this.unnestWithNumbers && fieldName === '__row_id') {
      return `${alias}_outer.__row_id`;
    } else if (isArray) {
      return alias;
    } else {
      return `${alias}.${this.sqlMaybeQuoteIdentifier(fieldName)}`;
    }
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `[${p}]`;
    }
    return `(SELECT UNNEST(${p}) as base)`;
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `DROP MACRO IF EXISTS ${id}; \n${hackSplitComment}\n CREATE MACRO ${id}(_param) AS (\n${indent(
      funcText
    )}\n);\n${hackSplitComment}\n`;
  }

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    dialectFieldList: DialectFieldList
  ): string {
    return `SELECT LIST(STRUCT_PACK(${dialectFieldList
      .map(d => this.sqlMaybeQuoteIdentifier(d.sqlOutputName))
      .join(',')})) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(
    alias: string,
    dialectFieldList: DialectFieldList
  ): string {
    return `STRUCT_PACK(${dialectFieldList
      .map(d => `${alias}.${d.sqlOutputName}`)
      .join(', ')})`;
  }
  // TODO
  // sqlMaybeQuoteIdentifier(identifier: string): string {
  //   return keywords.indexOf(identifier.toUpperCase()) > 0 ||
  //     identifier.match(/[a-zA-Z][a-zA-Z0-9]*/) === null || true
  //     ? '"' + identifier + '"'
  //     : identifier;
  // }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '"' + identifier + '"';
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented Yet');
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    let lVal = from.value;
    let rVal = to.value;
    if (!inDays(units)) {
      if (from.valueType === 'date') {
        lVal = mkExpr`(${lVal})::TIMESTAMP`;
      }
      if (to.valueType === 'date') {
        rVal = mkExpr`(${rVal})::TIMESTAMP`;
      }
    }
    return mkExpr`DATE_SUB('${units}',${lVal},${rVal})`;
  }

  sqlNow(): Expr {
    return mkExpr`LOCALTIMESTAMP`;
  }

  sqlTrunc(qi: QueryInfo, sqlTime: TimeValue, units: TimestampUnit): Expr {
    // adjusting for monday/sunday weeks
    const week = units === 'week';
    const truncThis = week
      ? mkExpr`${sqlTime.value} + INTERVAL 1 DAY`
      : sqlTime.value;
    if (sqlTime.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        const civilSource = mkExpr`(${truncThis}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
        let civilTrunc = mkExpr`DATE_TRUNC('${units}', ${civilSource})`;
        // MTOY todo ... only need to do this if this is a date ...
        civilTrunc = mkExpr`${civilTrunc}::TIMESTAMP`;
        const truncTsTz = mkExpr`${civilTrunc} AT TIME ZONE '${tz}'`;
        return mkExpr`(${truncTsTz})::TIMESTAMP`;
      }
    }
    let result = mkExpr`DATE_TRUNC('${units}', ${truncThis})`;
    if (week) {
      result = mkExpr`(${result} - INTERVAL 1 DAY)`;
    }
    return result;
  }

  sqlExtract(qi: QueryInfo, from: TimeValue, units: ExtractUnit): Expr {
    const pgUnits = pgExtractionMap[units] || units;
    let extractFrom = from.value;
    if (from.valueType === 'timestamp') {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = mkExpr`(${extractFrom}::TIMESTAMPTZ AT TIME ZONE '${tz}')`;
      }
    }
    const extracted = mkExpr`EXTRACT(${pgUnits} FROM ${extractFrom})`;
    return units === 'day_of_week' ? mkExpr`(${extracted}+1)` : extracted;
  }

  sqlAlterTime(
    op: '+' | '-',
    expr: TimeValue,
    n: Expr,
    timeframe: DateUnit
  ): Expr {
    if (timeframe === 'quarter') {
      timeframe = 'month';
      n = mkExpr`${n}*3`;
    }
    if (timeframe === 'week') {
      timeframe = 'day';
      n = mkExpr`${n}*7`;
    }
    const interval = mkExpr`INTERVAL (${n}) ${timeframe}`;
    return mkExpr`${expr.value} ${op} ${interval}`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastFragment): Expr {
    const op = `${cast.srcType}::${cast.dstType}`;
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      const tstz = mkExpr`${cast.expr}::TIMESTAMPTZ`;
      return mkExpr`CAST((${tstz}) AT TIME ZONE '${tz}' AS DATE)`;
    } else if (op === 'date::timestamp' && tz) {
      return mkExpr`CAST((${cast.expr})::TIMESTAMP AT TIME ZONE '${tz}' AS TIMESTAMP)`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? this.malloyTypeToSQLType({type: cast.dstType})
          : cast.dstType.raw;
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return mkExpr`${castFunc}(${cast.expr} AS ${dstType})`;
    }
    return cast.expr;
  }

  sqlRegexpMatch(expr: Expr, regexp: Expr): Expr {
    return mkExpr`REGEXP_MATCHES(${expr}, ${regexp})`;
  }

  sqlLiteralTime(
    qi: QueryInfo,
    timeString: string,
    type: TimeFieldType,
    timezone: string | undefined
  ): string {
    if (type === 'date') {
      return `DATE '${timeString}'`;
    }
    const tz = timezone || qtz(qi);
    if (tz) {
      return `TIMESTAMPTZ '${timeString} ${tz}'::TIMESTAMP`;
    }
    return `TIMESTAMP '${timeString}'`;
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    // return `sum_distinct(list({key:${key}, val: ${value}}))`;
    return `(
      SELECT ${funcName}(a.val) as value
      FROM (
        SELECT UNNEST(list(distinct {key:${key}, val: ${value}})) a
      )
    )`;
  }

  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
    return `(
      SELECT ${func(values.map((v, i) => `a.val${i}`))} as value
      FROM (
        SELECT UNNEST(list(distinct {key:${key}, ${values
          .map((v, i) => `val${i}: ${v}`)
          .join(',')}})) a
      )
    )`;
  }

  // sqlSumDistinct(key: string, value: string): string {
  //   const _factor = 32;
  //   const precision = 0.000001;
  //   const keySQL = `md5_number_lower(${key}::varchar)::int128`;
  //   return `
  //   (SUM(DISTINCT ${keySQL} + FLOOR(IFNULL(${value},0)/${precision})::int128) -  SUM(DISTINCT ${keySQL}))*${precision}
  //   `;
  // }

  // default duckdb to sampling 50K rows.
  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} USING SAMPLE ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} USING SAMPLE ${sample.percent} PERCENT (bernoulli))`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms.map(t => `${t} NULLS LAST`).join(',')}`;
  }

  sqlLiteralString(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  getGlobalFunctionDef(name: string): DialectFunctionOverloadDef[] | undefined {
    return DUCKDB_FUNCTIONS.get(name);
  }

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'integer';
      } else {
        return 'double precision';
      }
    } else if (malloyType.type === 'string') {
      return 'varchar';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return duckDBToMalloyTypes[baseSqlType.toUpperCase()];
  }

  castToString(expression: string): string {
    return `CAST(${expression} as VARCHAR)`;
  }

  concat(...values: string[]): string {
    return values.join(' || ');
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces:               TIMESTAMP WITH TIME ZONE
    // Parentheses, Commas:  DECIMAL(1, 1)
    // Brackets:             INT[ ]
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }
}
