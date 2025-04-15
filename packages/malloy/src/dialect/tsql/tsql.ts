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
import type {
  Sampling,
  AtomicTypeDef,
  TimeDeltaExpr,
  TypecastExpr,
  MeasureTimeExpr,
  BasicAtomicTypeDef,
  RecordLiteralNode,
  ArrayLiteralNode,
  RegexMatchExpr,
  TimeExtractExpr,
  TimeTruncExpr,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {DialectFieldList, FieldReferenceType, QueryInfo} from '../dialect';
import {Dialect} from '../dialect';
import {TSQL_DIALECT_FUNCTIONS} from './dialect_functions';
import {TSQL_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

// SQL Server funky default for json key
//'JSON_F52E2B61-18A1-11d1-B105-00805F49916B'

const tsqlDatePartMap: Record<string, string> = {
  'year': 'year',
  'month': 'month',
  'week': 'week',
  'day': 'day',
  'hour': 'hour',
  'minute': 'minute',
  'second': 'second',
};

const inSeconds: Record<string, number> = {
  'second': 1,
  'minute': 60,
  'hour': 3600,
  'day': 24 * 3600,
  'week': 7 * 24 * 3600,
};

const tsqlToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'varchar': {type: 'string'},
  'nvarchar': {type: 'string'},
  'text': {type: 'string'},
  'char': {type: 'string'},
  'nchar': {type: 'string'},
  'date': {type: 'date'},
  'int': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'smallint': {type: 'number', numberType: 'integer'},
  'tinyint': {type: 'number', numberType: 'integer'},
  'float': {type: 'number', numberType: 'float'},
  'real': {type: 'number', numberType: 'float'},
  'datetime': {type: 'timestamp'},
  'datetime2': {type: 'timestamp'},
  'datetimeoffset': {type: 'timestamp'},
  'bit': {type: 'boolean'},
  'numeric': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'money': {type: 'number', numberType: 'float'},
  'smallmoney': {type: 'number', numberType: 'float'},
  'binary': {type: 'string'},
  'varbinary': {type: 'string'},
  'uniqueidentifier': {type: 'string'},
};

export class TSQLDialect extends Dialect {
  name = 'tsql';
  defaultNumberType = 'FLOAT(53)';
  defaultDecimalType = 'NUMERIC';
  udfPrefix = 'tsql_temp.__udf';
  hasFinalStage = true;
  // TODO (vitor): This is a hack and I don't think it will work for streaming as it is.
  finalStageName = 'finalStage';

  divisionIsInteger = true;
  supportsSumDistinctFunction = false;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  supportsSafeCast = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsNesting = false;
  experimental = true;
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  compoundObjectInSchema = false;
  likeEscape = false;

  quoteTablePath(tablePath: string): string {
    console.info('quoteTablePath');
    return tablePath
      .split('.')
      .map(part => `[${part}]`)
      .join('.');
  }

  sqlGroupSetTable(groupSetCount: number): string {
    console.info('sqlGroupSetTable');
    // SQL Server doesn't have GENERATE_SERIES, use a common table expression
    // to generate numbers from 0 to groupSetCount
    return `CROSS JOIN (
      WITH numbers AS (
        SELECT 0 AS n
        UNION ALL
        SELECT n + 1 FROM numbers WHERE n < ${groupSetCount}
      )
      SELECT n FROM numbers
    ) AS group_set(group_set)`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    console.info('sqlAnyValue');
    return `MAX(${fieldName})`;
  }

  mapFields(fieldList: DialectFieldList): string {
    console.info('mapFields');
    return fieldList
      .map(
        f =>
          `\n  ${f.sqlExpression}${
            f.typeDef.type === 'number' ? `::${this.defaultNumberType}` : ''
          } as ${f.sqlOutputName}`
      )
      .join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    console.info('sqlAggregateTurtle');
    // SQL Server doesn't have JSONB functions like PostgreSQL
    // Use FOR JSON PATH to create JSON array
    const sql = `COALESCE((
      SELECT ${this.mapFields(fieldList)}
      FROM (SELECT 1) AS __dummy
      WHERE group_set=${groupSet}
      ${orderBy || ''}
      ${
        limit !== undefined ? `OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY` : ''
      }
      FOR JSON PATH
    ), '[]')`;
    return sql;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    console.info('sqlAnyValueTurtle');
    const fields = fieldList
      .map(f => `${f.sqlExpression} as ${f.sqlOutputName}`)
      .join(', ');
    // SQL Server doesn't have ANY_VALUE or STRUCT
    return `MAX(CASE WHEN group_set=${groupSet} THEN (
      SELECT ${fields} FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    ) END)`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    console.info('sqlAnyValueLastTurtle');
    // Using TOP 1 with aggregation to get the last non-null value
    return `(SELECT TOP 1 ${name} FROM (
      SELECT ${name}
      WHERE group_set=${groupSet} AND ${name} IS NOT NULL
      ORDER BY (SELECT NULL)
    ) t) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    console.info('sqlCoaleseMeasuresInline');
    // Using FOR JSON PATH to create JSON object
    return `(
      SELECT TOP 1 ${this.mapFields(fieldList)}
      WHERE group_set=${groupSet}
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    )`;
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    console.info('sqlUnnestAlias');
    // SQL Server doesn't have UNNEST or JSONB_ARRAY_ELEMENTS
    // Use OPENJSON to parse JSON arrays
    if (isArray) {
      if (needDistinctKey) {
        return `LEFT JOIN (
          SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS __row_id,
                 JSON_VALUE([value], '$.value') AS value
          FROM OPENJSON((SELECT ${source} FOR JSON PATH))
        ) AS ${alias} ON 1=1`;
      } else {
        return `LEFT JOIN (
          SELECT JSON_VALUE([value], '$.value') AS value
          FROM OPENJSON((SELECT ${source} FOR JSON PATH))
        ) AS ${alias} ON 1=1`;
      }
    } else if (needDistinctKey) {
      return `LEFT JOIN (
        SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS __row_number,
               *
        FROM OPENJSON(${source})
        WITH (
          ${fieldList
            .map(
              f =>
                `${f.sqlOutputName} ${this.malloyTypeToSQLType(f.typeDef)} '$.${
                  f.rawName
                }'`
            )
            .join(',\n  ')}
        )
      ) AS ${alias} ON 1=1`;
    } else {
      return `LEFT JOIN OPENJSON(${source}) AS ${alias} ON 1=1`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    console.info('sqlSumDistinctHashedKey');
    // SQL Server doesn't have MD5, use HASHBYTES instead
    return `CAST(HASHBYTES('SHA2_256', CAST(${sqlDistinctKey} AS NVARCHAR(MAX))) AS BIGINT)`;
  }

  sqlGenerateUUID(): string {
    console.info('sqlGenerateUUID');
    return 'NEWID()';
  }

  sqlFieldReference(
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string {
    if (childName === '__row_id') {
      return `${parentAlias}.__row_id`;
    }
    if (parentType !== 'table') {
      // Using SQL Server JSON functions
      let ret = `JSON_VALUE(${parentAlias}, '$.${childName}')`;
      switch (childType) {
        case 'string':
          break;
        case 'number':
          ret = `CAST(${ret} AS FLOAT)`;
          break;
        case 'struct':
        case 'array':
        case 'record':
        case 'array[record]':
        case 'sql native':
          ret = `JSON_QUERY(${parentAlias}, '$.${childName}')`;
          break;
      }
      console.info('ret', ret);
      return ret;
    } else {
      const child = this.sqlMaybeQuoteIdentifier(childName);
      console.info('childName', childName);
      console.info('child', child);
      return `${parentAlias}.${child}`;
    }
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    console.info('sqlUnnestPipelineHead');
    // SQL Server equivalent for unnesting JSON arrays
    if (isSingleton) {
      return `(SELECT ${sourceSQLExpression})`;
    } else {
      return `OPENJSON(${sourceSQLExpression})`;
    }
  }

  sqlCreateFunction(id: string, funcText: string): string {
    console.info('sqlCreateFunction');
    // SQL Server function creation syntax
    return `
      CREATE FUNCTION ${id}(@json NVARCHAR(MAX))
      RETURNS NVARCHAR(MAX)
      AS
      BEGIN
      ${indent(funcText)}
      END;
    `;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    console.info('sqlCreateFunctionCombineLastStage');
    // Using FOR JSON PATH to create a JSON array
    return `SELECT (SELECT * FROM ${lastStageName} FOR JSON PATH) AS result`;
  }

  sqlFinalStage(lastStageName: string, _fields: string[]): string {
    const res = `
    SELECT
      (SELECT ${lastStageName}.*
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) AS finalStage
    FROM ${lastStageName};
    `;
    return res;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    console.info('sqlSelectAliasAsStruct');
    // SQL Server doesn't have ROW constructor, use JSON
    return `(SELECT ${alias}.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)`;
  }

  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    console.info('sqlCreateTableAsSelect');
    throw new Error('Not implemented Yet');
  }

  sqlAlterTimeExpr(df: TimeDeltaExpr): string {
    console.info('sqlAlterTimeExpr');
    let timeframe = df.units;
    let n = df.kids.delta.sql;
    if (timeframe === 'quarter') {
      timeframe = 'month';
      n = `${n}*3`;
    } else if (timeframe === 'week') {
      timeframe = 'day';
      n = `${n}*7`;
    }

    // Using DATEADD instead of PostgreSQL's make_interval
    return `DATEADD(${tsqlDatePartMap[timeframe]}, ${
      df.op === '+' ? '' : '-'
    }${n}, ${df.kids.base.sql})`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    console.info('sqlCast');
    if (cast.safe) {
      throw new Error("TSQL dialect doesn't support Safe Cast");
    }
    const expr = cast.e.sql || '';
    const {
      op: _op,
      srcTypeDef,
      dstTypeDef,
      dstSQLType,
    } = this.sqlCastPrep(cast);

    if (!srcTypeDef || !dstTypeDef || srcTypeDef.type !== dstTypeDef.type) {
      return `CAST(${expr} AS ${dstSQLType})`;
    }
    return expr;
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    const lVal = from.sql;
    const rVal = to.sql;

    if (inSeconds[df.units]) {
      // DATEDIFF returns integer in the specified unit
      if (df.units === 'second') {
        return `DATEDIFF(SECOND, ${lVal}, ${rVal})`;
      } else {
        return `DATEDIFF(SECOND, ${lVal}, ${rVal}) / ${inSeconds[
          df.units
        ].toString()}`;
      }
    }
    throw new Error(`Unknown or unhandled tsql time unit: ${df.units}`);
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    console.info('sqlSumDistinct');
    // SQL Server version using DISTINCT with GROUP BY
    return `(
      SELECT ${funcName}(t.value)
      FROM (
        SELECT DISTINCT ${key} AS key, ${value} AS value
        FROM __temp_table
      ) t
    )`;
  }

  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
    console.info('sqlAggDistinct');
    // SQL Server version
    return `(
      SELECT ${func(values.map((_, i) => `t.val${i + 1}`))}
      FROM (
        SELECT DISTINCT ${key} AS key, ${values
          .map((v, i) => `${v} AS val${i + 1}`)
          .join(', ')}
        FROM __temp_table
      ) t
    )`;
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    console.info('sqlSampleTable');
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        // SQL Server TABLESAMPLE uses percent not rows, approximate with TOP
        return `(SELECT TOP ${sample.rows} * FROM ${tableSQL})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE (${sample.percent} PERCENT))`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    // SQL Server doesn't support NULLS LAST syntax directly
    // Use CASE expression to push NULLs to the end
    console.info('sqlOrderBy');
    return `ORDER BY ${orderTerms
      .map(t => {
        const parts = t.split(' ');
        const field = parts[0];
        const dir = parts.length > 1 ? parts[1] : '';
        return `CASE WHEN ${field} IS NULL THEN 1 ELSE 0 END, ${field} ${dir}`;
      })
      .join(',')}`;
  }

  sqlLiteralString(literal: string): string {
    console.info('sqlLiteralString');
    return "N'" + literal.replace(/'/g, "''") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    console.info('sqlLiteralRegexp');
    return "N'" + literal.replace(/'/g, "''") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    console.info('getDialectFunctionOverrides');
    return expandOverrideMap(TSQL_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    console.info('getDialectFunctions');
    return expandBlueprintMap(TSQL_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    console.info('malloyTypeToSQLType');
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'INT';
      } else {
        return 'FLOAT';
      }
    } else if (malloyType.type === 'string') {
      return 'NVARCHAR(MAX)';
    } else if (malloyType.type === 'date') {
      return 'DATE';
    } else if (malloyType.type === 'timestamp') {
      return 'DATETIME2';
    } else if (malloyType.type === 'boolean') {
      return 'BIT';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    console.info('sqlTypeToMalloyType');
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    return (
      tsqlToMalloyTypes[baseSqlType.trim().toLowerCase()] ?? {
        type: 'sql native',
        rawType: sqlType,
      }
    );
  }

  castToString(expression: string): string {
    console.info('castToString');
    return `CAST(${expression} as NVARCHAR(MAX))`;
  }

  concat(...values: string[]): string {
    console.info('concat');
    // SQL Server uses + for string concatenation
    return values.join(' + ');
  }

  validateTypeName(sqlType: string): boolean {
    console.info('validateTypeName');
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces:               TIMESTAMP WITH TIME ZONE
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Square Brackets:      INT64[]
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    console.info('sqlLiteralRecord');
    // Using JSON_OBJECT to create a JSON object in SQL Server
    const props: string[] = [];
    for (const [kName, kVal] of Object.entries(lit.kids)) {
      props.push(`'${kName}', ${kVal.sql}`);
    }
    return `(
      SELECT ${props
        .map((p, i) => (i % 2 === 0 ? p : `JSON_QUERY(${p})`))
        .join(', ')}
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    )`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    console.info('sqlLiteralArray');
    // Using FOR JSON PATH to create a JSON array
    const array = lit.kids.values.map(val => val.sql);
    return `(
      SELECT ${array.map((a, i) => `${a} AS col${i}`).join(', ')}
      FOR JSON PATH
    )`;
  }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    console.info('sqlMaybeQuoteIdentifier', identifier);
    return `[${identifier.replace(/\[/g, '[[').replace(/\]/g, ']]')}]`;
  }

  sqlNowExpr(): string {
    console.info('sqlNowExpr');
    return 'GETDATE()';
  }

  sqlTruncExpr(qi: QueryInfo, df: TimeTruncExpr): string {
    console.info('sqlTruncExpr');
    // SQL Server equivalent for DATE_TRUNC
    // const datePartMap: Record<string, string> = {
    //   'microsecond': 'MICROSECOND',
    //   'millisecond': 'MILLISECOND',
    //   'second': 'SECOND',
    //   'minute': 'MINUTE',
    //   'hour': 'HOUR',
    //   'day': 'DAY',
    //   'week': 'WEEK',
    //   'month': 'MONTH',
    //   'quarter': 'QUARTER',
    //   'year': 'YEAR',
    // };

    // const datePart = datePartMap[df.units];

    if (df.units === 'week') {
      // Adjust for week start (Monday)
      return `DATEADD(DAY,
               -DATEPART(WEEKDAY, ${df.e.sql}) + 1,
               DATEADD(DAY, DATEDIFF(DAY, 0, ${df.e.sql}), 0))`;
    } else if (df.units === 'quarter') {
      return `DATEADD(QUARTER, DATEDIFF(QUARTER, 0, ${df.e.sql}), 0)`;
    } else if (df.units === 'month') {
      return `DATEADD(MONTH, DATEDIFF(MONTH, 0, ${df.e.sql}), 0)`;
    } else if (df.units === 'year') {
      return `DATEADD(YEAR, DATEDIFF(YEAR, 0, ${df.e.sql}), 0)`;
    } else if (df.units === 'day') {
      return `CAST(CAST(${df.e.sql} AS DATE) AS DATETIME2)`;
    } else if (df.units === 'hour') {
      return `DATEADD(HOUR, DATEDIFF(HOUR, 0, ${df.e.sql}), 0)`;
    } else if (df.units === 'minute') {
      return `DATEADD(MINUTE, DATEDIFF(MINUTE, 0, ${df.e.sql}), 0)`;
    } else if (df.units === 'second') {
      return `DATEADD(SECOND, DATEDIFF(SECOND, 0, ${df.e.sql}), 0)`;
    } else {
      throw new Error(`Unsupported date truncation unit: ${df.units}`);
    }
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    console.info('sqlTimeExtractExpr');
    // SQL Server uses DATEPART
    const datePartMap: Record<string, string> = {
      'microsecond': 'MICROSECOND',
      'millisecond': 'MILLISECOND',
      'second': 'SECOND',
      'minute': 'MINUTE',
      'hour': 'HOUR',
      'day': 'DAY',
      'month': 'MONTH',
      'quarter': 'QUARTER',
      'year': 'YEAR',
      'day_of_week': 'WEEKDAY',
      'day_of_year': 'DAYOFYEAR',
    };

    const datePart = datePartMap[from.units];
    if (!datePart) {
      throw new Error(`Unsupported date extraction unit: ${from.units}`);
    }

    if (from.units === 'day_of_week') {
      // SQL Server WEEKDAY returns 1 for Sunday, add 1 to get Monday=1 format
      return `((DATEPART(WEEKDAY, ${from.e.sql}) + 5) % 7 + 1)`;
    }

    return `DATEPART(${datePart}, ${from.e.sql})`;
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    // SQL Server doesn't have native regex, use LIKE with wildcards or fallback to PATINDEX
    return `PATINDEX('%' + ${df.kids.regex.sql} + '%', ${df.kids.expr.sql}) > 0`;
  }

  sqlLiteralTime(
    qi: QueryInfo,
    lt: {typeDef: {type: string}; literal: string; timezone?: string}
  ): string {
    console.info('sqlLiteralTime');
    if (lt.typeDef.type === 'date') {
      return `CAST('${lt.literal}' AS DATE)`;
    }

    // SQL Server doesn't handle timezones directly
    // All timestamps are assumed local time
    return `CAST('${lt.literal}' AS DATETIME2)`;
  }
}
