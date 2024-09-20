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

import {indent} from '../../model/utils';
import {
  Sampling,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  FieldAtomicTypeDef,
  TimeTruncExpr,
  TimeExtractExpr,
  TimeDeltaExpr,
  TypecastExpr,
  RegexMatchExpr,
  TimeLiteralNode,
  MeasureTimeExpr,
} from '../../model/malloy_types';
import {
  DialectFunctionOverloadDef,
  expandOverrideMap,
  expandBlueprintMap,
} from '../functions';
import {Dialect, DialectFieldList, QueryInfo} from '../dialect';
import {STANDARDSQL_DIALECT_FUNCTIONS} from './dialect_functions';
import {STANDARDSQL_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

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

function dateMeasureable(units: string): boolean {
  return ['day', 'week', 'month', 'quarter', 'year'].includes(units);
}

const extractMap: Record<string, string> = {
  'day_of_week': 'dayofweek',
  'day_of_year': 'dayofyear',
};

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

const bqToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
  'DATE': {type: 'date'},
  'STRING': {type: 'string'},
  'INTEGER': {type: 'number', numberType: 'integer'},
  'INT64': {type: 'number', numberType: 'integer'},
  'FLOAT': {type: 'number', numberType: 'float'},
  'FLOAT64': {type: 'number', numberType: 'float'},
  'NUMERIC': {type: 'number', numberType: 'float'},
  'BIGNUMERIC': {type: 'number', numberType: 'float'},
  'TIMESTAMP': {type: 'timestamp'},
  'BOOLEAN': {type: 'boolean'},
  'BOOL': {type: 'boolean'},
  'JSON': {type: 'json'},
  // TODO (https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#tablefieldschema):
  // BYTES
  // DATETIME
  // TIME
  // GEOGRAPHY
};

export class StandardSQLDialect extends Dialect {
  name = 'standardsql';
  experimental = false;
  defaultNumberType = 'FLOAT64';
  defaultDecimalType = 'NUMERIC';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = false;
  supportsSumDistinctFunction = false;
  unnestWithNumbers = false;
  defaultSampling = {enable: false};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = true; // bigquery can't use a sample table more than once in a query.
  supportsQualify = true;
  supportsSafeCast = true;
  supportsNesting = true;
  cantPartitionWindowFunctionsOnExpressions = true;
  hasModOperator = false;

  quoteTablePath(tablePath: string): string {
    return `\`${tablePath}\``;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(GENERATE_ARRAY(0,${groupSetCount},1)))`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${fieldName} END)`;
  }
  // can array agg or any_value a struct...
  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    let tail = '';
    if (limit !== undefined) {
      tail += ` LIMIT ${limit}`;
    }
    const fields = fieldList
      .map(f => `\n  ${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    return `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}\n  ) END IGNORE NULLS ${orderBy} ${tail})`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}))`;
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
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    const nullValues = fieldList
      .map(f => `NULL as ${f.sqlOutputName}`)
      .join(', ');

    return `COALESCE(ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END), STRUCT(${nullValues}))`;
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
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    if (isArray) {
      if (needDistinctKey) {
        return `LEFT JOIN UNNEST(ARRAY(( SELECT AS STRUCT row_number() over() as __row_id, value FROM UNNEST(${source}) value))) as ${alias}`;
      } else {
        return `LEFT JOIN UNNEST(ARRAY((SELECT AS STRUCT value FROM unnest(${source}) value))) as ${alias}`;
      }
    } else if (needDistinctKey) {
      return `LEFT JOIN UNNEST(ARRAY(( SELECT AS STRUCT row_number() over() as __row_id, * FROM UNNEST(${source})))) as ${alias}`;
    } else {
      return `LEFT JOIN UNNEST(${source}) as ${alias}`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS STRING)`;
    const upperPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 1, 15)) as int64) as numeric) * 4294967296`;
    const lowerPart = `cast(cast(concat('0x', substr(to_hex(md5(${sqlDistinctKey})), 16, 8)) as int64) as numeric)`;
    // See the comment below on `sql_sum_distinct` for why we multiply by this decimal
    const precisionShiftMultiplier = '0.000000001';
    return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    return 'GENERATE_UUID()';
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean,
    _isArray: boolean
  ): string {
    return `${alias}.${fieldName}`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `[${p}]`;
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

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT ARRAY((SELECT AS STRUCT * FROM ${lastStageName}))\n`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `(SELECT AS STRUCT ${alias}.*)`;
  }

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

  sqlMaybeQuoteIdentifier(identifier: string): string {
    // return this.keywords.indexOf(identifier.toUpperCase()) > 0
    //   ? '`' + identifier + '`'
    //   : identifier;
    return '`' + identifier + '`';
  }

  sqlNowExpr(): string {
    return 'CURRENT_TIMESTAMP()';
  }

  sqlTruncExpr(qi: QueryInfo, trunc: TimeTruncExpr): string {
    const tz = qtz(qi);
    const tzAdd = tz ? `, "${tz}"` : '';
    if (trunc.e.dataType === 'date') {
      if (dateMeasureable(trunc.units)) {
        return `DATE_TRUNC(${trunc.e.sql},${trunc.units})`;
      }
      return `TIMESTAMP(${trunc.e.sql}${tzAdd})`;
    }
    return `TIMESTAMP_TRUNC(${trunc.e.sql},${trunc.units}${tzAdd})`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, te: TimeExtractExpr): string {
    const extractTo = extractMap[te.units] || te.units;
    const tz = te.e.dataType === 'timestamp' && qtz(qi);
    const tzAdd = tz ? ` AT TIME ZONE '${tz}'` : '';
    return `EXTRACT(${extractTo} FROM ${te.e.sql}${tzAdd})`;
  }

  sqlAlterTimeExpr(df: TimeDeltaExpr): string {
    const from = df.kids.base;
    let dataType: string = from.dataType;
    let sql = from.sql;
    if (df.units !== 'day' && timestampMeasureable(df.units)) {
      // The units must be done in timestamp, no matter the input type
      if (dataType !== 'timestamp') {
        sql = `TIMESTAMP(${sql})`;
        dataType = 'timestamp';
      }
    } else if (dataType === 'timestamp') {
      sql = `DATETIME(${sql})`;
      dataType = 'datetime';
    }
    const funcTail = df.op === '+' ? '_ADD' : '_SUB';
    const funcName = `${dataType.toUpperCase()}${funcTail}`;
    const newTime = `${funcName}(${sql}, INTERVAL ${df.kids.delta.sql} ${df.units})`;
    if (dataType === from.dataType) {
      return newTime;
    }
    return `${from.dataType.toUpperCase()}(${newTime})`;
  }

  ignoreInProject(fieldName: string): boolean {
    return fieldName === '_PARTITIONTIME';
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const op = `${cast.srcType}::${cast.dstType}`;
    const tz = qtz(qi);
    const src = cast.e.sql || '';
    if (op === 'timestamp::date' && tz) {
      return `DATE(${src},'${tz}')`;
    }
    if (op === 'date::timestamp' && tz) {
      return `TIMESTAMP(${src}, '${tz}')`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? this.malloyTypeToSQLType({type: cast.dstType})
          : cast.dstType.raw;
      const castFunc = cast.safe ? 'SAFE_CAST' : 'CAST';
      return `${castFunc}(${src} AS ${dstType})`;
    }
    return src;
  }

  sqlRegexpMatch(match: RegexMatchExpr): string {
    return `REGEXP_CONTAINS(${match.kids.expr.sql},${match.kids.regex.sql})`;
  }

  sqlLiteralTime(qi: QueryInfo, lit: TimeLiteralNode): string {
    if (lit.dataType === 'date') {
      return `DATE('${lit.literal}')`;
    } else if (lit.dataType === 'timestamp') {
      let timestampArgs = `'${lit.literal}'`;
      const tz = lit.timezone || qtz(qi);
      if (tz && tz !== 'UTC') {
        timestampArgs += `,'${tz}'`;
      }
      return `TIMESTAMP(${timestampArgs})`;
    } else {
      throw new Error(`Unsupported Literal time format ${lit.dataType}`);
    }
  }

  sqlMeasureTimeExpr(measure: MeasureTimeExpr): string {
    const measureMap: Record<string, TimeMeasure> = {
      'microsecond': {use: 'microsecond', ratio: 1},
      'millisecond': {use: 'microsecond', ratio: 1000},
      'second': {use: 'millisecond', ratio: 1000},
      'minute': {use: 'second', ratio: 60},
      'hour': {use: 'minute', ratio: 60},
      'day': {use: 'hour', ratio: 24},
      'week': {use: 'day', ratio: 7},
    };
    const from = measure.kids.left;
    const to = measure.kids.right;
    let lVal = from.sql;
    let rVal = to.sql;
    if (measureMap[measure.units]) {
      const {use: measureIn, ratio} = measureMap[measure.units];
      if (!timestampMeasureable(measureIn)) {
        throw new Error(`Measure in '${measureIn} not implemented`);
      }
      if (from.dataType !== to.dataType) {
        throw new Error("Can't measure difference between different types");
      }
      if (from.dataType === 'date') {
        lVal = `TIMESTAMP(${lVal})`;
        rVal = `TIMESTAMP(${rVal})`;
      }
      let measured = `TIMESTAMP_DIFF(${rVal},${lVal},${measureIn})`;
      if (ratio !== 1) {
        measured = `FLOOR(${measured}/${ratio.toString()}.0)`;
      }
      return measured;
    }
    throw new Error(`Measure '${measure.units} not implemented`);
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        throw new Error(
          "StandardSQL doesn't support sampling by rows only percent"
        );
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL}  TABLESAMPLE SYSTEM (${sample.percent} PERCENT))`;
      }
    }
    return tableSQL;
  }

  sqlLiteralString(literal: string): string {
    const noVirgule = literal.replace(/\\/g, '\\\\');
    return "'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    const noVirgule = literal.replace(/\\/g, '\\\\');
    return "'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(STANDARDSQL_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(STANDARDSQL_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'INT64';
      } else {
        return 'FLOAT64';
      }
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return bqToMalloyTypes[baseSqlType.toUpperCase()];
  }

  castToString(expression: string): string {
    return `CAST(${expression} as STRING)`;
  }

  concat(...values: string[]): string {
    return values.join(' || ');
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces,
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Angle Brackets:       ARRAY<INT64>
    return sqlType.match(/^[A-Za-z\s(),<>0-9]*$/) !== null;
  }
}
