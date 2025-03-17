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
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,p
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {indent} from '../../model/utils';
import type {
  Expr,
  Sampling,
  AtomicTypeDef,
  TimeDeltaExpr,
  TypecastExpr,
  RegexMatchExpr,
  MeasureTimeExpr,
  TimeLiteralNode,
  TimeExtractExpr,
  LeafAtomicTypeDef,
  RecordLiteralNode,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
  isAtomic,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {DialectFieldList, OrderByClauseType, QueryInfo} from '../dialect';
import {isDialectFieldStruct} from '../dialect';
import {PostgresBase, timeExtractMap} from '../pg_impl';
import {
  PRESTO_DIALECT_FUNCTIONS,
  TRINO_DIALECT_FUNCTIONS,
} from './dialect_functions';
import {TRINO_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

// These are the units that "TIMESTAMP_ADD" "TIMESTAMP_DIFF" accept
function timestampMeasureable(units: string): boolean {
  return [
    'microsecond',
    'millisecond',
    'second',
    'minute',
    'hour',
    'day',
  ].includes(units);
}

/**
 * Return a non UTC timezone, if one was specificed.
 */
function qtz(qi: QueryInfo): string | undefined {
  const tz = qi.queryTimezone;
  if (tz && tz !== 'UTC') {
    return tz;
  }
}

declare interface TimeMeasure {
  use: string;
  ratio: number;
}

const trinoTypeMap = {
  'string': 'VARCHAR',
  'number': 'DOUBLE',
};

const trinoToMalloyTypes: {[key: string]: LeafAtomicTypeDef} = {
  'varchar': {type: 'string'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'smallint': {type: 'number', numberType: 'integer'},
  'tinyint': {type: 'number', numberType: 'integer'},
  'double': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'string': {type: 'string'},
  'date': {type: 'date'},
  'timestamp': {type: 'timestamp'},
  'boolean': {type: 'boolean'},

  // TODO(figutierrez0): cleanup.
  /* 'INT64': {type: 'number', numberType: 'integer'},
  'FLOAT': {type: 'number', numberType: 'float'},
  'FLOAT64': {type: 'number', numberType: 'float'},
  'NUMERIC': {type: 'number', numberType: 'float'},
  'BIGNUMERIC': {type: 'number', numberType: 'float'},
  'TIMESTAMP': {type: 'timestamp'},
  'BOOLEAN': {type: 'boolean'},
  'BOOL': {type: 'boolean'},
  'JSON': {type: 'json'},*/
  // TODO (https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema):
  // BYTES
  // DATETIME
  // TIME
  // GEOGRAPHY
};

export class TrinoDialect extends PostgresBase {
  name = 'trino';
  experimental = false;
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {enable: false};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = true; // bigquery can't use a sample table more than once in a query.
  supportsQualify = true;
  supportsSafeCast = true;
  supportsNesting = true;
  cantPartitionWindowFunctionsOnExpressions = false;
  orderByClause: OrderByClauseType = 'output_name';
  nullMatchesFunctionSignature = false;
  supportsSelectReplace = false;
  supportsComplexFilteredSources = false;
  supportsTempTables = false;
  supportsCountApprox = true;
  supportsHyperLogLog = true;

  quoteTablePath(tablePath: string): string {
    // TODO: look into escaping.
    //return `${tablePath.replace(/malloytest/g, 'malloy_demo.malloytest')}`;
    return tablePath;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(SEQUENCE(0,${groupSetCount})))`;
  }

  exprToSQL(qi: QueryInfo, df: Expr): string | undefined {
    switch (df.node) {
      case '/':
        return `CAST(${df.kids.left.sql} AS DOUBLE)/${df.kids.right.sql}`;
    }
    return super.exprToSQL(qi, df);
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }

  buildTypeExpression(fieldList: DialectFieldList): string {
    const fields: string[] = [];
    for (const f of fieldList) {
      if (isDialectFieldStruct(f)) {
        let s = `ROW(${this.buildTypeExpression(f.nestedStruct)})`;
        if (f.isArray) {
          s = `array(${s})`;
        }
        fields.push(`${f.sqlOutputName} ${s}`);
      } else {
        fields.push(`${f.sqlOutputName} ${trinoTypeMap[f.type] || f.type}`);
      }
    }
    return fields.join(', \n');
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    const expressions = fieldList.map(f => f.sqlExpression).join(',\n ');
    const definitions = this.buildTypeExpression(fieldList);
    let ret = `ARRAY_AGG(CAST(ROW(${expressions}) AS ROW(${definitions})) ${orderBy}) FILTER (WHERE group_set=${groupSet})`;
    if (limit !== undefined) {
      ret = `SLICE(${ret}, 1, ${limit})`;
    }
    return ret;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `\n '${f.sqlOutputName}' VALUE ${f.sqlExpression}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN JSON_OBJECT(${fields}))`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${name} END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const nullValues = fieldList.map(_f => 'NULL').join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN CAST(ROW(${fields}) AS ROW(${definitions})) END), CAST(ROW(${nullValues}) AS ROW(${definitions})))`;
  }

  //
  // this code used to be:
  //
  //   from += `JOIN UNNEST(GENERATE_ARRAY(0,${this.maxGroupSet},1)) as group_set\n`;
  //
  // BigQuery will allocate more resources if we use a CROSS JOIN so we do that instead.
  //
  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        // return `LEFT JOIN UNNEST(transform(${source}, x -> ROW(x) )) WITH ORDINALIITY as words_0(value,__row_id_from_${alias}) ON TRUE`;
        return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) WITH ORDINALITY as ${alias}(value, ignore,__row_id_from_${alias}) ON TRUE`;
      } else {
        return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) as ${alias}(value, ignore) ON TRUE`;
      }
    } else if (needDistinctKey) {
      return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) WITH ORDINALITY as ${alias}_outer(${alias}, ignore,__row_id_from_${alias}) ON TRUE`;
    } else {
      return `LEFT JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore)))as ${alias}_outer(${alias},ignore) ON TRUE`;
    }
  }
  static dtype = 'DECIMAL(38,0)';

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS VARCHAR)`;

    const upperPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 1, 15),16) as ${TrinoDialect.dtype}) * CAST('4294967296' AS ${TrinoDialect.dtype}) `;
    const lowerPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 16, 8),16) as ${TrinoDialect.dtype}) `;
    return `(${upperPart} + ${lowerPart})`;
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const hashKey = this.sqlSumDistinctHashedKey(key);
    const scale = 100000000;
    const v = `CAST(COALESCE(${value},0)*${scale} as ${TrinoDialect.dtype})`;

    const sqlSum = `CAST(SUM(DISTINCT ${hashKey} + ${v}) - SUM(DISTINCT ${hashKey}) AS DOUBLE)/${scale}`;
    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END),0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  sqlGenerateUUID(): string {
    return 'UUID()';
  }

  sqlFieldReference(
    parentAlias: string,
    _parentType: unknown,
    childName: string,
    _childType: string
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (childName === '__row_id') {
      return `__row_id_from_${parentAlias}`;
    }
    return `${parentAlias}.${this.sqlMaybeQuoteIdentifier(childName)}`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `ARRAY[${p}]`;
    }
    return `UNNEST(${p})`;
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `CREATE TEMPORARY FUNCTION ${id}(__param ANY TYPE) AS ((\n${indent(
      funcText
    )}));\n`;
  }

  sqlCreateTableAsSelect(tableName: string, sql: string): string {
    return `
CREATE TABLE IF NOT EXISTS \`${tableName}\`
OPTIONS (
    expiration_timestamp=TIMESTAMP_ADD(current_timestamp(),  INTERVAL 1 hour)
)
AS (
${indent(sql)}
);
`;
  }

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `SELECT ARRAY_AGG(CAST(ROW(${fields}) as ROW(${definitions}))) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(alias: string, fieldList): string {
    const fields = fieldList.map(f => f.sqlExpression).join(', ');
    const definitions = this.buildTypeExpression(fieldList);
    return `CAST(ROW(${fields}) as ROW(${definitions})`;
  }

  // TODO(figutierrez): update.
  keywords = `
  ALL
  AND
  ANY
  ARRAY
  AS
  ASC
  ASSERT_ROWS_MODIFIED
  AT
  BETWEEN
  BY
  CASE
  CAST
  COLLATE
  CONTAINS
  CREATE
  CROSS
  CUBE
  CURRENT
  DEFAULT
  DEFINE
  DESC
  DISTINCT
  ELSE
  END
  ENUM
  ESCAPE
  EXCEPT
  EXCLUDE
  EXISTS
  EXTRACT
  FALSE
  FETCH
  FOLLOWING
  FOR
  FROM
  FULL
  GROUP
  GROUPING
  GROUPS
  HASH
  HAVING
  IF
  IGNORE
  IN
  INNER
  INTERSECT
  INTERVAL
  INTO
  IS
  JOIN
  LATERAL
  LEFT
  LIKE
  LIMIT
  LOOKUP
  MERGE
  NATURAL
  NEW
  NO
  NOT
  NULL
  NULLS
  OF
  ON
  OR
  ORDER
  OUTER
  OVER
  PARTITION
  PRECEDING
  PROTO
  RANGE
  RECURSIVE
  RESPECT
  RIGHT
  ROLLUP
  ROWS
  SELECT
  SET
  SOME
  STRUCT
  TABLESAMPLE
  THEN
  TO
  TREAT
  TRUE
  UNBOUNDED
  UNION
  UNNEST
  USING
  WHEN
  WHERE
  WINDOW
  WITH
  WITHIN`.split(/\s/);

  sqlAlterTimeExpr(df: TimeDeltaExpr): string {
    let timeframe = df.units;
    let n = df.kids.delta.sql;
    if (timeframe === 'quarter') {
      timeframe = 'month';
      n = `${n}*3`;
    }
    if (timeframe === 'week') {
      timeframe = 'day';
      n = `${n}*7`;
    }
    if (df.op === '-') {
      n = `(${n})*-1`;
    }
    return `DATE_ADD('${timeframe}', ${n}, ${df.kids.base.sql})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    const expr = cast.e.sql || '';
    if (op === 'timestamp::date' && tz) {
      const tstz = `CAST(${expr} as TIMESTAMP)`;
      return `CAST((${tstz}) AT TIME ZONE '${tz}' AS DATE)`;
    } else if (op === 'date::timestamp' && tz) {
      return `CAST(CONCAT(CAST(CAST(${expr} AS TIMESTAMP) AS VARCHAR), ' ${tz}') AS TIMESTAMP WITH TIME ZONE)`;
    }
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      const castFunc = cast.safe ? 'TRY_CAST' : 'CAST';
      return `${castFunc}(${expr} AS ${dstSQLType})`;
    }
    return expr;
  }

  sqlRegexpMatch(reCmp: RegexMatchExpr): string {
    return `REGEXP_LIKE(${reCmp.kids.expr.sql}, ${reCmp.kids.regex.sql})`;
  }

  sqlMeasureTimeExpr(mf: MeasureTimeExpr): string {
    const measureMap: Record<string, TimeMeasure> = {
      'microsecond': {use: 'microsecond', ratio: 1},
      'millisecond': {use: 'microsecond', ratio: 1000},
      'second': {use: 'millisecond', ratio: 1000},
      'minute': {use: 'second', ratio: 60},
      'hour': {use: 'minute', ratio: 60},
      'day': {use: 'hour', ratio: 24},
      'week': {use: 'day', ratio: 7},
    };
    const from = mf.kids.left;
    const to = mf.kids.right;
    let lVal = from.sql;
    let rVal = to.sql;
    if (measureMap[mf.units]) {
      const {use: measureIn, ratio} = measureMap[mf.units];
      if (!timestampMeasureable(measureIn)) {
        throw new Error(`Measure in '${measureIn} not implemented`);
      }
      if (!TD.eq(from.typeDef, to.typeDef)) {
        throw new Error("Can't measure difference between different types");
      }
      if (TD.isDate(from.typeDef)) {
        lVal = `CAST(${lVal} AS TIMESTAMP)`;
        rVal = `CAST(${rVal} AS TIMESTAMP)`;
      }
      let measured = `DATE_DIFF('${measureIn}',${lVal},${rVal})`;
      if (ratio !== 1) {
        measured = `FLOOR(CAST(${measured} AS DOUBLE)/${ratio.toString()}.0)`;
      }
      return measured;
    }
    throw new Error(`Measure '${mf.units} not implemented`);
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        throw new Error("Trino doesn't support sampling by rows only percent");
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL}  TABLESAMPLE SYSTEM (${sample.percent}))`;
      }
    }
    return tableSQL;
  }

  sqlLiteralString(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(TRINO_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(TRINO_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    switch (malloyType.type) {
      case 'number':
        return malloyType.numberType === 'integer' ? 'BIGINT' : 'DOUBLE';
      case 'string':
        return 'VARCHAR';
      case 'record': {
        const typeSpec: string[] = [];
        for (const f of malloyType.fields) {
          if (isAtomic(f)) {
            typeSpec.push(`${f.name} ${this.malloyTypeToSQLType(f)}`);
          }
        }
        return `ROW(${typeSpec.join(',')})`;
      }
      case 'sql native':
        return malloyType.rawType || 'UNKNOWN-NATIVE';
      case 'array': {
        if (malloyType.elementTypeDef.type !== 'record_element') {
          return `ARRAY<${this.malloyTypeToSQLType(
            malloyType.elementTypeDef
          )}>`;
        }
        return malloyType.type.toUpperCase();
      }
      default:
        return malloyType.type.toUpperCase();
    }
  }

  sqlTypeToMalloyType(sqlType: string): LeafAtomicTypeDef {
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return (
      trinoToMalloyTypes[baseSqlType] ?? {
        type: 'sql native',
        rawType: sqlType,
      }
    );
  }

  castToString(expression: string): string {
    return `CAST(${expression} as VARCHAR)`;
  }

  concat(...values: string[]): string {
    return values.join(' || ');
  }

  sqlMakeUnnestKey(key: string, rowKey: string) {
    return `CAST(${key} as VARCHAR) || 'x' || CAST(${rowKey} as VARCHAR)`;
  }

  sqlStringAggDistinct(
    distinctKey: string,
    valueSQL: string,
    separatorSQL: string
  ) {
    return `
    ARRAY_JOIN(TRANSFORM(ARRAY_AGG(DISTINCT ARRAY[CAST(${valueSQL} AS VARCHAR),CAST(${distinctKey} as VARCHAR)]), x -> x[1]),${
      separatorSQL.length > 0 ? separatorSQL : "','"
    })`;
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces,
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Angle Brackets:       ARRAY<INT64>
    return sqlType.match(/^[A-Za-z\s(),<>0-9]*$/) !== null;
  }

  sqlLiteralTime(qi: QueryInfo, lit: TimeLiteralNode): string {
    if (TD.isDate(lit.typeDef)) {
      return `DATE '${lit.literal}'`;
    }
    const tz = lit.timezone || qtz(qi);
    if (tz) {
      return `TIMESTAMP '${lit.literal} ${tz}'`;
    }
    return `TIMESTAMP '${lit.literal}'`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const pgUnits = timeExtractMap[from.units] || from.units;
    let extractFrom = from.e.sql || '';
    if (TD.isTimestamp(from.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = `at_timezone(${extractFrom},'${tz}')`;
      }
    }
    const extracted = `EXTRACT(${pgUnits} FROM ${extractFrom})`;
    return from.units === 'day_of_week' ? `mod(${extracted}+1,7)` : extracted;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const rowVals: string[] = [];
    const rowTypes: string[] = [];
    for (const f of lit.typeDef.fields) {
      if (isAtomic(f)) {
        const name = f.as ?? f.name;
        rowVals.push(lit.kids[name].sql ?? 'internal-error-record-literal');
        const elType = this.malloyTypeToSQLType(f);
        rowTypes.push(`${name} ${elType}`);
      }
    }
    return `CAST(ROW(${rowVals.join(',')}) AS ROW(${rowTypes.join(',')}))`;
  }
}

export class PrestoDialect extends TrinoDialect {
  name = 'presto';
  supportsPipelinesInViews = false; // what a drag...
  supportsLeftJoinUnnest = false; // we need to fix this....

  sqlGenerateUUID(): string {
    return 'CAST(UUID() AS VARCHAR)';
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        // return `LEFT JOIN UNNEST(transform(${source}, x -> CAST(ROW(x) as ROW(value) )) WITH ORDINALIITY as words_0(value,__row_id_from_${alias}) ON TRUE`;
        return (
          '-- Simulate a left join\n' +
          `CROSS JOIN  UNNEST(COALESCE(${source},ARRAY[NULL])) WITH ORDINALITY as ${alias}(value, __row_id_almost_${alias})\n` +
          `CROSS JOIN UNNEST(ARRAY[CASE WHEN ${source} IS NOT NULL THEN __row_id_almost_${alias} END]) as ${alias}_ignore(__row_id_from_${alias})`
        );
      } else {
        // return `CROSS JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) as ${alias}(value, ignore)`;
        return `CROSS JOIN  UNNEST(COALESCE(${source}, ARRAY[NULL])) as ${alias}(value) `;
      }
    } else if (needDistinctKey) {
      // return `CROSS JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore))) WITH ORDINALITY as ${alias}_outer(${alias}, ignore,__row_id_from_${alias})`;
      return (
        '-- Simulate a left join\n' +
        `CROSS JOIN UNNEST(COALESCE(${source}, ARRAY[NULL])) WITH ORDINALITY as ${alias}_outer(${alias}, __row_id_almost_${alias})\n` +
        `CROSS JOIN UNNEST(ARRAY[CASE WHEN ${source} IS NOT NULL THEN __row_id_almost_${alias} END]) as ${alias}_ignore(__row_id_from_${alias})`
      );
    } else {
      // return `CROSS JOIN UNNEST(zip_with(${source},array[],(r,ignore) -> (r, ignore)))as ${alias}_outer(${alias},ignore)`;
      return `CROSS JOIN  UNNEST(COALESCE(${source}, ARRAY[NULL])) as ${alias}_outer(${alias})`;
    }
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(PRESTO_DIALECT_FUNCTIONS);
  }
}
