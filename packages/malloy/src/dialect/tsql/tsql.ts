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
  Expr,
  RegexLiteralNode,
  StringLiteralNode,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  isBasicAtomic,
  isRawCast,
} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {DialectFieldList, FieldReferenceType, QueryInfo} from '../dialect';
import {Dialect} from '../dialect';
import {TSQL_DIALECT_FUNCTIONS} from './dialect_functions';
import {TSQL_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

// SQL Server funky default for json key 'JSON_F52E2B61-18A1-11d1-B105-00805F49916B'
// Weeks appear to start on sunday according to time-lietral.ts and snowflake_executor.ts . This is also the sqlserver convention
// However, since that is configurable through @@DATEFIRST , we are avoiding using DATEPART for weeks which uses @@DATEFIRST
// DATEADD's first parameter is a datepart value so we will be referencing those dateparts, just not the function.
// DATETRUNC is also based on @@DATEFIRST so we will avoid that for weeks too.

// TODO (vitor): Organize this, this is duplicated
// TODO (vitor): THESE REGEXP ARE SO SUS
const NON_NATURAL_NUMBER_EXPR =
  /[-+]?(?:\d*\.\d+|\d+\.\d*|\d+(?:\.\d+)?[eE][-+]?\d+)/;
// const SQL_STR_LITERAL_EXPR = /^'(?:[^']|'')*'$/;
const INVALID_ORDER_BY_EXPR = NON_NATURAL_NUMBER_EXPR;

const tsqlDatePartMap: Record<string, string> = {
  'microsecond': 'microsecond',
  'millisecond': 'millisecond',
  'second': 'second',
  'minute': 'minute',
  'hour': 'hour',
  'day': 'day',
  'week': 'week',
  'month': 'month',
  'quarter': 'quarter',
  'year': 'year',
  'day_of_week': 'weekday',
  'day_of_year': 'dayofyear',
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
  'smallint': {type: 'number', numberType: 'integer'},
  'tinyint': {type: 'number', numberType: 'integer'},
  'float': {type: 'number', numberType: 'float'},
  'real': {type: 'number', numberType: 'float'},
  'datetime': {type: 'timestamp'},
  'datetime2': {type: 'timestamp'},
  'datetimeoffset': {type: 'timestamp'},
  'bit': {type: 'boolean'},
  'numeric(38,0)': {type: 'number', numberType: 'integer'},
  'numeric': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'money': {type: 'number', numberType: 'float'},
  'smallmoney': {type: 'number', numberType: 'float'},
  'binary': {type: 'string'},
  'varbinary': {type: 'string'},
  'uniqueidentifier': {type: 'string'},
};

export class TSQLDialect extends Dialect {
  // TODO (vitor): Split tsql into different dialects maybe
  name = 'tsql';
  defaultNumberType = 'float(53)';
  defaultDecimalType = 'numeric(38)';
  udfPrefix = 'tsql_temp.__udf';
  // TODO (vitor): hasFinalStage is set to false for now because I don't know why it would be needed.
  hasFinalStage = false;
  divisionIsInteger = true;
  // TODO (vitor): Gotta leave supportsSumDistinctFunction as true i guess.
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = false;
  supportsAggDistinct = false;
  supportsCTEinCoorelatedSubQueries = false;
  supportsSafeCast = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsNesting = false;
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  compoundObjectInSchema = false;
  experimental = true;
  booleanAsNumbers = true;
  supportsLimit = false;

  // tsql doesn't support nulls last, so we are using orderByClause expression for now to make things easier
  // wether or not it actually makes it easier idk, but I can make nulls last with CASE expressions.
  orderByClause = 'expression' as const;
  groupByClause = 'expression' as const;
  limitClause = 'top' as const;
  booleanType = 'none' as const;

  // SQL Server does have ESCAPE but Synapse doesn't
  likeEscape = false;

  // TODO (vitor): idk about this cantPartitionWindowFunctionsOnExpressions...
  // There's a problem with non top level CTE's with sqlserver
  cantPartitionWindowFunctionsOnExpressions = false;

  quoteTablePath(tablePath: string): string {
    // console.info('quoteTablePath');
    return tablePath
      .split('.')
      .map(part => `[${part}]`)
      .join('.')
      .replace(/`/g, '');
  }

  sqlGroupSetTable(groupSetCount: number): string {
    // SQL Server doesn't have GENERATE_SERIES, use a common table expression
    // to generate numbers from 0 to groupSetCount
    return `
    CROSS JOIN (
      SELECT n AS group_set
      FROM dbo.malloynumbers
      WHERE n <= ${groupSetCount}
    ) AS group_set
    `;
  }

  exprToSQL(qi: QueryInfo, df: Expr) {
    switch (df.node) {
      case 'not':
        // -vitor: Sorry! I feel like woody the woodpecker saying i did not not not not not eat all the pizza
        return `NOT COALESCE(CASE WHEN (${df.e.sql}) THEN 1 END, 0) = 1`;
      // TODO (vitor): Maybe this should be handled on super?
      // But then it would be based on dialect, idk. This is needed either way.
      // Otherwise youre gonna get joins `ON false`
      case 'true':
      case 'false':
        return df.node === 'true' ? '1=1' : '1=0';
      default:
        return super.exprToSQL(qi, df);
    }
  }

  // TODO (vitor): Figure out if i need to use groupSet here.
  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `MAX(${fieldName})`;
  }

  // TODO (vitor): Is this :: casting a malloy thing or a dialect thing?
  mapFields(fieldList: DialectFieldList): string {
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
    // console.info('sqlAggregateTurtle');
    // SQL Server doesn't have JSONB functions like PostgreSQL
    // Use FOR JSON PATH to create JSON array
    const sql = `COALESCE((
      SELECT ${limit ? `TOP ${limit} ` : ''} ${this.mapFields(fieldList)}
      FROM (SELECT 1) AS __dummy
      WHERE group_set=${groupSet}
      ${orderBy || ''}
      ${orderBy && !limit ? 'OFFSET 0 ROWS' : ''}
      FOR JSON PATH
    ), '[]')`;
    return sql;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
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
    // console.info('sqlAnyValueLastTurtle');
    // Using TOP 1 with aggregation to get the last non-null value
    return `
    (
      SELECT TOP 1 ${name}
      FROM (
        SELECT ${name}
        WHERE group_set=${groupSet} AND ${name} IS NOT NULL
      ) t
      ORDER BY (SELECT NULL)
    ) as ${sqlName}\n`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    // console.info('sqlCoaleseMeasuresInline');
    // Using FOR JSON PATH to create JSON object
    return `(
      SELECT TOP 1 ${this.mapFields(fieldList)}
      WHERE group_set=${groupSet}
      FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    )`;
  }

  // TODO (vitor): Need to figure out a way out if that WITH statement there
  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
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

  sqlSumDistinctHashedKey(_sqlDistinctKey: string): string {
    return '!DO_NOT_USE_ME_sqlSumDistinctHashedKey!';
  }

  sqlGenerateUUID(): string {
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
          ret = `CAST(${ret} AS ${this.defaultNumberType})`;
          break;
        case 'struct':
        case 'array':
        case 'record':
        case 'array[record]':
        case 'sql native':
          ret = `JSON_QUERY(${parentAlias}, '$.${childName}')`;
          break;
      }
      return ret;
    } else {
      const child = this.sqlMaybeQuoteIdentifier(childName);
      return `${parentAlias}.${child}`;
    }
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    // SQL Server equivalent for unnesting JSON arrays
    if (isSingleton) {
      return `(SELECT ${sourceSQLExpression})`;
    } else {
      return `OPENJSON(${sourceSQLExpression})`;
    }
  }

  sqlCreateFunction(id: string, funcText: string): string {
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
    // Using FOR JSON PATH to create a JSON array
    return `SELECT (SELECT * FROM ${lastStageName} FOR JSON PATH) AS result`;
  }

  sqlFinalStage(_lastStageName: string, _fields: string[]): string {
    return '!DO_NOT_USE_ME_sqlFinalStage!';
  }

  sqlSelectAliasAsStruct(alias: string): string {
    // SQL Server doesn't have ROW constructor, use JSON
    return `(SELECT ${alias}.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)`;
  }

  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented');
  }

  sqlAlterTimeExpr(df: TimeDeltaExpr): string {
    let timeframe = df.units;
    let n = df.kids.delta.sql;
    if (timeframe === 'quarter') {
      timeframe = 'month';
      n = `${n}*3`;
    } else if (timeframe === 'week') {
      timeframe = 'day';
      n = `${n}*7`;
    }

    // TODO (vitor): check why this is needed and if it should be the opposite
    return `
    -- operatorthing start
    DATEADD(${tsqlDatePartMap[timeframe]}, ${
      df.op === '-' ? '-' : '+'
    }(${n}), (${df.kids.base.sql}))
    -- operatorthing end
    `;
  }

  // TODO (vitor): Not sure about this...
  sqlCastPrep(cast: TypecastExpr): {
    op: string;
    srcTypeDef: BasicAtomicTypeDef | undefined;
    dstTypeDef: BasicAtomicTypeDef | undefined;
    dstSQLType: string;
  } {
    let srcTypeDef = cast.srcType || cast.e.typeDef;
    const src = srcTypeDef?.type || 'unknown';
    if (srcTypeDef && !isBasicAtomic(srcTypeDef)) {
      srcTypeDef = undefined;
    }
    if (isRawCast(cast)) {
      return {
        op: `CAST ${src} AS '${cast.dstSQLType}')`,
        srcTypeDef,
        dstTypeDef: undefined,
        dstSQLType: cast.dstSQLType,
      };
    }
    return {
      op: `CAST(${src} AS ${cast.dstType.type})`,
      srcTypeDef,
      dstTypeDef: cast.dstType,
      dstSQLType: this.malloyTypeToSQLType(cast.dstType),
    };
  }

  // TODO (vitor): This function interacts with sqlCastPrep. Need to check if I'm not double casting I guess...
  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
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
    const sqlDistinctKey = `CONCAT(${key}, '')`;

    const valueScale = 6;
    const intermediatePrecision = 28; // Must be >= 19 (for BIGINT hash) and accommodate value's integer part.

    const integerHash = `ABS(CONVERT(BIGINT, SUBSTRING(HASHBYTES('MD5', ${sqlDistinctKey}), 1, 8)))`;
    const hashKeyDecimal = `CAST(${integerHash} AS DECIMAL(${intermediatePrecision},${valueScale}))`;

    const v = `CAST(COALESCE(${value}, 0) AS DECIMAL(${intermediatePrecision},${valueScale}))`;

    const sumItemPrecision = intermediatePrecision + 1;

    const term1 = `CAST((${hashKeyDecimal} + ${v}) AS DECIMAL(${sumItemPrecision},${valueScale}))`;
    const term2 = hashKeyDecimal; // Already DECIMAL(intermediatePrecision, valueScale)

    const sqlSum = `(
        CAST(
            (SUM(DISTINCT ${term1})) - (SUM(DISTINCT ${term2}))
        AS DECIMAL(38, ${valueScale}))
    )`;

    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum} * 1.0 / NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${sqlDistinctKey} END), 0))`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  // TODO (vitor): Test this properly
  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
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

  // TODO (vitor): Revisit this function
  sqlOrderBy(orderTerms: string[]): string {
    // SQL Server doesn't support NULLS LAST syntax directly
    // Use CASE expression to push NULLs to the end
    const wrappedTerms = orderTerms
      .map((t, i) => {
        const match = t.match(/\b(asc|desc)\b/i);
        let field: string | null = '';
        let dir = '';
        if (match) {
          const index = match.index;
          [field, dir] = [t.slice(0, index), t.slice(index)];
        } else {
          field = t;
        }
        return !INVALID_ORDER_BY_EXPR.test(field)
          ? `(SELECT CASE WHEN (${field}) IS NULL THEN ${
              i + 1
            } ELSE 0 END), ${field} ${dir}`
          : null;
      })
      .filter((v): v is string => !!v);

    return wrappedTerms.length ? 'ORDER BY ' + wrappedTerms.join(', ') : '';
  }

  // TODO (vitor): I think the point in other dialects is to allow escaping
  // but since \\ is \, then you need to make \\ into \\\\ if its going
  // to be escaped twice.
  // I expect this to be the final step but I'm not totally sure. Should be fine
  // if we use tsql literal strings but idk if this is a good idea yet.
  sqlLiteralString(literal: string): string {
    const noEscape = literal.replace(/\\\\/g, '\\');
    return "N'" + noEscape.replace(/'/g, "''") + "'";
  }

  // TODO (vitor): Same as sqlLiteralString
  sqlLiteralRegexp(literal: string): string {
    const noEscape = literal.replace(/\\\\/g, '\\');
    return "N'" + noEscape.replace(/'/g, "''") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(TSQL_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(TSQL_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        // TODO (vitor): This NUMERIC(38,0) might be dicey
        return 'NUMERIC(38,0)';
      } else {
        return this.defaultNumberType;
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
    return `CAST(${expression} as NVARCHAR(MAX))`;
  }

  concat(...values: string[]): string {
    // SQL Server uses + for string concatenation
    return values.join(' + ');
  }

  validateTypeName(sqlType: string): boolean {
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
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
    // Using FOR JSON PATH to create a JSON array
    const array = lit.kids.values.map(val => val.sql);
    return `(
      SELECT ${array.map((a, i) => `${a} AS col${i}`).join(', ')}
      FOR JSON PATH
    )`;
  }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '[' + identifier.replace(/"/g, '') + ']';
  }

  sqlNowExpr(): string {
    return 'GETDATE()';
  }

  sqlDateToString(sqlDateExp: string) {
    return `CONVERT(varchar(10), ${sqlDateExp}, 23)`;
  }

  sqlTruncExpr(qi: QueryInfo, df: TimeTruncExpr): string {
    const datePart = tsqlDatePartMap[df.units];
    if (!datePart) {
      // TODO (vitor): Check throwing conventions
      throw new Error('Invalid date part');
    }
    const d = df.e.sql;

    const id = Math.floor(Math.random() * 1000);
    if (datePart === 'week') {
      return `
      -- trunc ${datePart} start ${id}
      DATEADD(
        DAY,
        -((DATEDIFF(DAY, 0, ${d}) + 1) % 7), ${d}
      )
      -- trunc ${datePart} end ${id}
      `;
    } else {
      return `
      -- trunc ${datePart} start ${id}
      DATETRUNC(${datePart}, ${d})
      -- trunc ${datePart} end ${id}
      `;
    }
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    const datePart = tsqlDatePartMap[from.units];
    const d = from.e.sql;

    const id = Math.floor(Math.random() * 1000);
    switch (datePart) {
      case 'year':
        return `YEAR(${d})`;
      case 'quarter':
        return `((MONTH(${d}) - 1) / 3 + 1)`;
      case 'month':
        return `MONTH(${d})`;
      case 'day':
        return `DAY(${d})`;
      case 'weekday':
        return `
        -- weekday start ${id}
        (SELECT DATEDIFF(day, '17530107', ${d}) % 7 + 1)
        -- weekday end ${id}
        `;
      case 'hour':
        return `(DATEDIFF(hour, CONVERT(date, ${d}), ${d}))`;
      case 'minute':
        return `(DATEDIFF(minute, DATEADD(hour, DATEDIFF(hour, 0, ${d}), 0), ${d}))`;
      case 'second':
        return `(DATEDIFF(second, DATEADD(minute, DATEDIFF(minute, 0, ${d}), 0), ${d}))`;
      case 'millisecond':
        return `(DATEDIFF(millisecond, DATEADD(second, DATEDIFF(second, 0, ${d}), 0), ${d}))`;
      default:
        throw new Error(`Unsupported date extraction unit: ${from.units}`);
    }
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    const exprSql = df.kids.expr.sql;
    const regexOperandNode = df.kids.regex;

    if (
      regexOperandNode.node === 'stringLiteral' ||
      regexOperandNode.node === 'regexpLiteral'
    ) {
      let rawRegexValue: string | undefined;

      if (regexOperandNode.node === 'stringLiteral') {
        rawRegexValue = (regexOperandNode as StringLiteralNode).literal;
      } else {
        rawRegexValue = (regexOperandNode as RegexLiteralNode).literal;
      }

      const hasStartAnchor = rawRegexValue.startsWith('^');
      const hasEndAnchor = rawRegexValue.endsWith('$');

      let core = rawRegexValue;
      if (hasStartAnchor) core = core.slice(1);
      if (hasEndAnchor) core = core.slice(0, -1);
      core = core.replace(/[()]/g, '');

      rawRegexValue = core
        .split('|')
        .map(
          part =>
            `${hasStartAnchor ? '^' : ''}${part}${hasEndAnchor ? '$' : ''}`
        )
        .join('|');

      if (rawRegexValue === '') {
        return `${exprSql} = ''`;
      }
      if (rawRegexValue === null || rawRegexValue === undefined) {
        return '1=0';
      }

      const subPatterns = rawRegexValue.split('|');
      const conditions: string[] = [];

      for (const subPattern of subPatterns) {
        let currentPattern = subPattern.trim();
        if (currentPattern === '') {
          conditions.push(`${exprSql} = ''`);
          continue;
        }

        let anchoredStart = false;
        if (currentPattern.startsWith('^')) {
          currentPattern = currentPattern.substring(1);
          anchoredStart = true;
        }
        let anchoredEnd = false;
        if (currentPattern.endsWith('$')) {
          currentPattern = currentPattern.substring(
            0,
            currentPattern.length - 1
          );
          anchoredEnd = true;
        }

        if (currentPattern === '') {
          conditions.push(`${exprSql} = ''`);
          continue;
        }

        currentPattern = currentPattern.replace(/\\%/g, '[%]');
        currentPattern = currentPattern.replace(/\\_/g, '[_]');

        currentPattern = currentPattern.replace(/\\d/g, '[0-9]');
        currentPattern = currentPattern.replace(/\\w/g, '[a-zA-Z0-9_]');
        currentPattern = currentPattern.replace(/\\s/g, '[ \t\r\n\f\v]');
        currentPattern = currentPattern.replace(/\\D/g, '[^0-9]');
        currentPattern = currentPattern.replace(/\\W/g, '[^a-zA-Z0-9_]');

        if (!anchoredStart && !currentPattern.startsWith('%')) {
          currentPattern = '%' + currentPattern;
        }
        if (!anchoredEnd && !currentPattern.endsWith('%')) {
          currentPattern = currentPattern + '%';
        }

        const sqlSafePattern = currentPattern.replace(/'/g, "''");
        const sqlLiteral = `N'${sqlSafePattern}'`;
        conditions.push(`PATINDEX(${sqlLiteral}, ${exprSql}) > 0`);
      }

      if (conditions.length === 0) {
        return '1=0';
      }
      return conditions.join(' OR ');
    } else {
      const patternSql = regexOperandNode.sql;
      if (!patternSql) {
        return '1=0';
      }
      return `PATINDEX(${patternSql}, ${exprSql}) > 0`;
    }
  }

  sqlLiteralTime(
    qi: QueryInfo,
    lt: {typeDef: {type: string}; literal: string; timezone?: string}
  ): string {
    if (lt.typeDef.type === 'date') {
      return `CAST('${lt.literal}' AS DATE)`;
    }

    // SQL Server doesn't handle timezones directly
    // All timestamps are assumed local time
    return `CAST('${lt.literal}' AS DATETIME2)`;
  }
}
