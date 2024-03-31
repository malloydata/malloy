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
import {
  Expr,
  ExtractUnit,
  Sampling,
  TimeValue,
  TimestampUnit,
  TypecastFragment,
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  mkExpr,
  FieldAtomicTypeDef,
  DialectFragment,
} from '../../model/malloy_types';
import {TRINO_FUNCTIONS} from './functions';
import {DialectFunctionOverloadDef} from '../functions';
import {
  Dialect,
  DialectFieldList,
  OrderByClauseType,
  QueryInfo,
  isDialectFieldStruct,
} from '../dialect';

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

const trinoTypeMap = {
  'string': 'VARCHAR',
  'number': 'DOUBLE',
};

export class TrinoDialect extends Dialect {
  name = 'trino';
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = '__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
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
  orderByClause: OrderByClauseType = 'output_name';

  quoteTablePath(tablePath: string): string {
    // TODO: look into escaping.
    //return `${tablePath.replace(/malloytest/g, 'malloy_demo.malloytest')}`;
    return tablePath;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT row_number() OVER() -1  group_set FROM UNNEST(SEQUENCE(0,${groupSetCount})))`;
  }

  dialectExpr(qi: QueryInfo, df: DialectFragment): Expr {
    switch (df.function) {
      case 'div': {
        return mkExpr`CAST(${df.numerator} AS DOUBLE)/${df.denominator}`;
      }
    }
    return super.dialectExpr(qi, df);
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
        fields.push(s);
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
    let ret = `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN CAST(ROW(${expressions}) AS ROW(${definitions})) END ${orderBy})`;
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
    const fieldsNames = fieldList.map(f =>
      this.sqlMaybeQuoteIdentifier(f.sqlOutputName)
    );
    if (isArray) {
      if (needDistinctKey) {
        return `,UNNEST(ARRAY(( SELECT AS STRUCT row_number() over() as __row_id, value FROM UNNEST(${source}) value))) as ${alias}`;
      } else {
        return `,UNNEST(ARRAY((SELECT AS STRUCT value FROM unnest(${source}) value))) as ${alias}`;
      }
    } else if (needDistinctKey) {
      return `,UNNEST(zip_with(a, SEQUENCE(1,cardinality(a)), (r,__row_id) -> (r, __row_id))) as ${alias}_outer(${alias},__row_id)`;
    } else {
      return `,UNNEST(${source}) as ${alias}(${fieldsNames.join(', ')})`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    sqlDistinctKey = `CAST(${sqlDistinctKey} AS VARCHAR)`;

    const upperPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 1, 15),16) as DECIMAL) * DECIMAL '4294967296' `;
    const lowerPart = `cast(from_base(substr(to_hex(md5(to_utf8(${sqlDistinctKey}))), 16, 8),16) as DECIMAL) `;
    const precisionShiftMultiplier = '0.000000001';
    return `(${upperPart} + ${lowerPart}) * ${precisionShiftMultiplier}`;
  }

  sqlGenerateUUID(): string {
    return 'UUID()';
  }

  sqlFieldReference(
    alias: string,
    fieldName: string,
    _fieldType: string,
    _isNested: boolean,
    _isArray: boolean
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (fieldName === '__row_id') {
      return `${alias}_outer.__row_id`;
    }
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

  sqlMaybeQuoteIdentifier(identifier: string): string {
    // return this.keywords.indexOf(identifier.toUpperCase()) > 0
    //   ? '`' + identifier + '`'
    //   : identifier;
    return identifier;

    // TODO: may need to escape;
    //return `"${identifier}"`;
  }

  sqlNow(): Expr {
    return mkExpr`CURRENT_TIMESTAMP()`;
  }

  sqlTrunc(qi: QueryInfo, sqlTime: TimeValue, units: TimestampUnit): Expr {
    const tz = qtz(qi);
    const tzAdd = tz ? `, "${tz}"` : '';
    if (sqlTime.valueType === 'date') {
      if (dateMeasureable(units)) {
        return mkExpr`DATE_TRUNC(${sqlTime.value},${units})`;
      }
      return mkExpr`TIMESTAMP(${sqlTime.value}${tzAdd})`;
    }
    return mkExpr`TIMESTAMP_TRUNC(${sqlTime.value},${units}${tzAdd})`;
  }

  sqlExtract(qi: QueryInfo, expr: TimeValue, units: ExtractUnit): Expr {
    const extractTo = extractMap[units] || units;
    const tz = expr.valueType === 'timestamp' && qtz(qi);
    const tzAdd = tz ? ` AT TIME ZONE '${tz}'` : '';
    return mkExpr`EXTRACT(${extractTo} FROM ${expr.value}${tzAdd})`;
  }

  sqlAlterTime(
    op: '+' | '-',
    expr: TimeValue,
    n: Expr,
    timeframe: TimestampUnit
  ): Expr {
    let theTime = expr.value;
    let computeType: string = expr.valueType;
    if (timeframe !== 'day' && timestampMeasureable(timeframe)) {
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
    if (computeType === expr.valueType) {
      return newTime;
    }
    return mkExpr`${expr.valueType.toUpperCase()}(${newTime})`;
  }

  ignoreInProject(fieldName: string): boolean {
    return fieldName === '_PARTITIONTIME';
  }

  sqlCast(qi: QueryInfo, cast: TypecastFragment): Expr {
    const op = `${cast.srcType}::${cast.dstType}`;
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      return mkExpr`DATE(${cast.expr},'${tz}')`;
    }
    if (op === 'date::timestamp' && tz) {
      return mkExpr`TIMESTAMP(${cast.expr}, '${tz}')`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? this.malloyTypeToSQLType({type: cast.dstType})
          : cast.dstType.raw;
      const castFunc = cast.safe ? 'SAFE_CAST' : 'CAST';
      return mkExpr`${castFunc}(${cast.expr} AS ${dstType})`;
    }
    return cast.expr;
  }

  sqlRegexpMatch(expr: Expr, regexp: Expr): Expr {
    return mkExpr`REGEXP_LIKE(${expr}, ${regexp})`;
  }

  sqlLiteralTime(
    qi: QueryInfo,
    timeString: string,
    type: 'date' | 'timestamp',
    timezone: string | undefined
  ): string {
    if (type === 'date') {
      return `DATE('${timeString}')`;
    } else if (type === 'timestamp') {
      let timestampArgs = `'${timeString}'`;
      const tz = timezone || qtz(qi);
      if (tz && tz !== 'UTC') {
        timestampArgs += `,'${tz}'`;
      }
      return `TIMESTAMP(${timestampArgs})`;
    } else {
      throw new Error(`Unsupported Literal time format ${type}`);
    }
  }

  sqlMeasureTime(from: TimeValue, to: TimeValue, units: string): Expr {
    const measureMap: Record<string, TimeMeasure> = {
      'microsecond': {use: 'microsecond', ratio: 1},
      'millisecond': {use: 'microsecond', ratio: 1000},
      'second': {use: 'millisecond', ratio: 1000},
      'minute': {use: 'second', ratio: 60},
      'hour': {use: 'minute', ratio: 60},
      'day': {use: 'hour', ratio: 24},
      'week': {use: 'day', ratio: 7},
    };
    let lVal = from.value;
    let rVal = to.value;
    if (measureMap[units]) {
      const {use: measureIn, ratio} = measureMap[units];
      if (!timestampMeasureable(measureIn)) {
        throw new Error(`Measure in '${measureIn} not implemented`);
      }
      if (from.valueType !== to.valueType) {
        throw new Error("Can't measure difference between different types");
      }
      if (from.valueType === 'date') {
        lVal = mkExpr`TIMESTAMP(${lVal})`;
        rVal = mkExpr`TIMESTAMP(${rVal})`;
      }
      let measured = mkExpr`TIMESTAMP_DIFF(${rVal},${lVal},${measureIn})`;
      if (ratio !== 1) {
        measured = mkExpr`FLOOR(${measured}/${ratio.toString()}.0)`;
      }
      return measured;
    }
    throw new Error(`Measure '${units} not implemented`);
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

  getGlobalFunctionDef(name: string): DialectFunctionOverloadDef[] | undefined {
    // TODO: implement
    return TRINO_FUNCTIONS.get(name);
  }

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'BIGINT';
      } else {
        return 'DOUBLE';
      }
    } else if (malloyType.type === 'string') {
      return 'VARCHAR';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(_sqlType: string): FieldAtomicTypeDef | undefined {
    // TODO(figutierrez): unimplemented.
    return undefined;
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
    // Spaces,
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Angle Brackets:       ARRAY<INT64>
    return sqlType.match(/^[A-Za-z\s(),<>0-9]*$/) !== null;
  }
}
