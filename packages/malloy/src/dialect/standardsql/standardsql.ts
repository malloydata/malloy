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
  Expr,
  ExtractUnit,
  Sampling,
  TimeValue,
  TimestampUnit,
  TypecastFragment,
  isDateUnit,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  isTimeFieldType,
  mkExpr,
} from '../../model/malloy_types';
import {Dialect, DialectFieldList} from '../dialect';
import {STANDARDSQL_FUNCTIONS} from './functions';
import {DialectFunctionOverloadDef} from '../functions';

const castMap: Record<string, string> = {
  number: 'float64',
};

// These are the units that "TIMESTAMP_ADD" accepts
const timestampAddUnits = [
  'microsecond',
  'millisecond',
  'second',
  'minute',
  'hour',
  'day',
];

const extractMap: Record<string, string> = {
  day_of_week: 'dayofweek',
  day_of_year: 'dayofyear',
};

export class StandardSQLDialect extends Dialect {
  name = 'standardsql';
  defaultNumberType = 'FLOAT64';
  udfPrefix = '__udf';
  hasFinalStage = false;
  stringTypeName = 'STRING';
  divisionIsInteger = false;
  supportsSumDistinctFunction = false;
  unnestWithNumbers = false;
  defaultSampling = {enable: false};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  dontUnionIndex = true; // bigquery can't use a sample table more than once in a query.
  supportsQualify = true;

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
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN ${name}__${groupSet} END) as ${sqlName}`;
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
    isArray: boolean
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
    return this.keywords.indexOf(identifier.toUpperCase()) > 0
      ? '`' + identifier + '`'
      : identifier;
  }

  sqlNow(): Expr {
    return mkExpr`CURRENT_TIMESTAMP()`;
  }

  sqlTrunc(sqlTime: TimeValue, units: TimestampUnit): Expr {
    if (sqlTime.valueType === 'date') {
      if (isDateUnit(units)) {
        return mkExpr`DATE_TRUNC(${sqlTime.value},${units})`;
      }
      return mkExpr`TIMESTAMP(${sqlTime.value})`;
    }
    return mkExpr`TIMESTAMP_TRUNC(${sqlTime.value},${units})`;
  }

  sqlExtract(expr: TimeValue, units: ExtractUnit): Expr {
    const extractTo = extractMap[units] || units;
    return mkExpr`EXTRACT(${extractTo} FROM ${expr.value})`;
  }

  sqlAlterTime(
    op: '+' | '-',
    expr: TimeValue,
    n: Expr,
    timeframe: TimestampUnit
  ): Expr {
    let theTime = expr.value;
    let computeType: string = expr.valueType;
    if (timeframe !== 'day' && timestampAddUnits.includes(timeframe)) {
      // The units must be done in timestamp, no matter the input type
      computeType = 'timestamp';
      if (expr.valueType !== 'timestamp') {
        theTime = mkExpr`TIMESTAMP(${theTime})`;
      }
    } else if (expr.valueType === 'timestamp') {
      theTime = mkExpr`DATETIME(${theTime})`;
      computeType = 'datetime';
    }
    const funcName = computeType.toUpperCase() + (op === '+' ? '_ADD' : '_SUB');
    const newTime = mkExpr`${funcName}(${theTime}, INTERVAL ${n} ${timeframe})`;
    return computeType === 'datetime' ? mkExpr`TIMESTAMP(${newTime})` : newTime;
  }

  ignoreInProject(fieldName: string): boolean {
    return fieldName === '_PARTITIONTIME';
  }

  sqlCast(cast: TypecastFragment): Expr {
    if (cast.srcType !== cast.dstType) {
      const dstType = castMap[cast.dstType] || cast.dstType;
      // This just makes the code look a little prettier ...
      if (!cast.safe && cast.srcType && isTimeFieldType(cast.srcType)) {
        if (dstType === 'date') {
          return mkExpr`DATE(${cast.expr})`;
        }
        return mkExpr`TIMESTAMP(${cast.expr})`;
      }
      const castFunc = cast.safe ? 'SAFE_CAST' : 'CAST';
      return mkExpr`${castFunc}(${cast.expr}  AS ${dstType})`;
    }
    return cast.expr;
  }

  sqlRegexpMatch(expr: Expr, regexp: string): Expr {
    return mkExpr`REGEXP_CONTAINS(${expr}, r${regexp})`;
  }

  sqlLiteralTime(
    timeString: string,
    type: 'date' | 'timestamp',
    timezone: string
  ): string {
    if (type === 'date') {
      return `DATE('${timeString}')`;
    } else if (type === 'timestamp') {
      return `TIMESTAMP('${timeString}', '${timezone}')`;
    } else {
      throw new Error(`Unknown Liternal time format ${type}`);
    }
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    let lVal = from.value;
    let rVal = to.value;
    let diffUsing = 'TIMESTAMP_DIFF';

    if (units === 'second' || units === 'minute' || units === 'hour') {
      if (from.valueType !== 'timestamp') {
        lVal = mkExpr`TIMESTAMP(${lVal})`;
      }
      if (to.valueType !== 'timestamp') {
        rVal = mkExpr`TIMESTAMP(${rVal})`;
      }
    } else {
      diffUsing = 'DATE_DIFF';
      if (from.valueType !== 'date') {
        lVal = mkExpr`DATE(${lVal})`;
      }
      if (to.valueType !== 'date') {
        rVal = mkExpr`DATE(${rVal})`;
      }
    }
    return mkExpr`${diffUsing}(${rVal}, ${lVal}, ${units})`;
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
    return "r'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  getGlobalFunctionDef(name: string): DialectFunctionOverloadDef[] | undefined {
    return STANDARDSQL_FUNCTIONS.get(name);
  }
}
