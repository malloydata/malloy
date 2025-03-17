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

// import {
//   Dialect,
//   DialectFieldList,
//   QueryInfo,
//   qtz,
//   DialectFunctionOverloadDef,
// } from '..';
import type {
  Sampling,
  MeasureTimeExpr,
  TimeLiteralNode,
  RegexMatchExpr,
  TimeDeltaExpr,
  TimeTruncExpr,
  TimeExtractExpr,
  TypecastExpr,
  LeafAtomicTypeDef,
  AtomicTypeDef,
  ArrayLiteralNode,
  RecordLiteralNode,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingRows,
  isSamplingPercent,
  TD,
} from '../../model/malloy_types';
import {indent} from '../../model/utils';
import type {DialectFieldList, FieldReferenceType, QueryInfo} from '../dialect';
import {Dialect, qtz} from '../dialect';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandBlueprintMap, expandOverrideMap} from '../functions';
import {MYSQL_DIALECT_FUNCTIONS} from './dialect_functions';
import {MYSQL_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

const msExtractionMap: Record<string, string> = {
  day_of_week: 'DAYOFWEEK',
  day_of_year: 'DAYOFYEAR',
};

const inSeconds: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 24 * 3600,
  week: 7 * 24 * 3600,
};

const mysqlToMalloyTypes: {[key: string]: LeafAtomicTypeDef} = {
  // TODO: This assumes tinyint is always going to be a boolean.
  'tinyint': {type: 'boolean'},
  'smallint': {type: 'number', numberType: 'integer'},
  'mediumint': {type: 'number', numberType: 'integer'},
  'int': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'tinyint unsigned': {type: 'number', numberType: 'integer'},
  'smallint unsigned': {type: 'number', numberType: 'integer'},
  'mediumint unsigned': {type: 'number', numberType: 'integer'},
  'int unsigned': {type: 'number', numberType: 'integer'},
  'bigint unsigned': {type: 'number', numberType: 'integer'},
  'double': {type: 'number', numberType: 'float'},
  'varchar': {type: 'string'},
  'varbinary': {type: 'string'},
  'char': {type: 'string'},
  'text': {type: 'string'},
  'date': {type: 'date'},
  'datetime': {type: 'timestamp'},
  'timestamp': {type: 'timestamp'},
  'time': {type: 'string'},
  'decimal': {type: 'number', numberType: 'float'},
  // TODO: Check if we need special handling for boolean.
  'tinyint(1)': {type: 'boolean'},
};

export class MySQLDialect extends Dialect {
  name = 'mysql';
  defaultNumberType = 'DOUBLE PRECISION';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = 'ms_temp.__udf';
  hasFinalStage = false;
  // TODO: this may not be enough for larger casts.
  stringTypeName = 'VARCHAR(255)';
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = true;
  supportsAggDistinct = true;
  supportsCTEinCoorelatedSubQueries = true;
  supportsSafeCast = false;
  dontUnionIndex = false;
  supportsQualify = false;
  supportsNesting = true;
  experimental = false;
  supportsFullJoin = false;
  supportsPipelinesInViews = false;
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  supportsArraysInData = false;
  compoundObjectInSchema = false;
  booleanAsNumbers = true;

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    switch (malloyType.type) {
      case 'number':
        return malloyType.numberType === 'integer' ? 'BIGINT' : 'DOUBLE';
      case 'string':
        return 'CHAR';
      case 'date':
      case 'timestamp':
      default:
        return malloyType.type;
    }
  }

  sqlTypeToMalloyType(sqlType: string): LeafAtomicTypeDef {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return (
      mysqlToMalloyTypes[baseSqlType.toLowerCase()] || {
        type: 'sql native',
        rawType: baseSqlType,
      }
    );
  }

  quoteTablePath(tablePath: string): string {
    return tablePath
      .split('.')
      .map(part => `\`${part}\``)
      .join('.');
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (select number - 1 as group_set from JSON_TABLE(cast(concat("[1", repeat(",1", ${groupSetCount}), "]") as JSON),"$[*]" COLUMNS(number FOR ORDINALITY)) group_set) as group_set`;
  }

  sqlAnyValue(_groupSet: number, fieldName: string): string {
    return `MAX(${fieldName})`;
  }

  private mapFields(fieldList: DialectFieldList): string {
    return fieldList.map(f => `"${f.rawName}", ${f.sqlExpression}`).join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
    limit: number | undefined
  ): string {
    const separator = limit ? ',xrmmex' : ',';
    let gc = `GROUP_CONCAT(
      IF(group_set=${groupSet},
        JSON_OBJECT(${this.mapFields(fieldList)})
        , null
        )
      ${orderBy}
      SEPARATOR '${separator}'
    )`;
    if (limit) {
      gc = `SUBSTRING_INDEX(${gc}, '${separator}', ${limit})`;
      gc = `REPLACE(${gc},'${separator}',',')`;
    }
    gc = `COALESCE(JSON_EXTRACT(CONCAT('[',${gc},']'),'$'),JSON_ARRAY())`;
    return gc;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = this.mapFieldsForJsonObject(fieldList);
    return `MAX(CASE WHEN group_set=${groupSet} THEN JSON_OBJECT(${fields}) END)`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `MAX(CASE WHEN group_set=${groupSet} AND ${name} IS NOT NULL THEN ${name} END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = this.mapFieldsForJsonObject(fieldList);
    const nullValues = this.mapFieldsForJsonObject(fieldList, true);

    return `COALESCE(MAX(CASE WHEN group_set=${groupSet} THEN JSON_OBJECT(${fields}) END),JSON_OBJECT(${nullValues}))`;
  }

  malloyToSQL(t: string) {
    if (t === 'number') {
      return 'DOUBLE';
    } else if (t === 'string') {
      return 'TEXT';
    } else if (t === 'struct' || t === 'array' || t === 'record') {
      return 'JSON';
    } else return t;
  }
  unnestColumns(fieldList: DialectFieldList) {
    const fields: string[] = [];
    for (const f of fieldList) {
      fields.push(
        `${this.sqlMaybeQuoteIdentifier(f.sqlOutputName)} ${this.malloyToSQL(
          f.type
        )} PATH "$.${f.rawName}"`
      );
    }
    return fields.join(',\n');
  }

  jsonTable(
    source: string,
    fieldList: DialectFieldList,
    isSingleton: boolean
  ): string {
    let fields = this.unnestColumns(fieldList);
    if (isSingleton) {
      // LTNOTE: we need the type of array here.
      fields = "`value` JSON PATH '$'";
    }
    return `JSON_TABLE(CAST(${source} AS JSON), '$[*]'
        COLUMNS (
          __row_id FOR ORDINALITY,
          ${fields}
        )
      )`;
  }

  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    _needDistinctKey: boolean,
    isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    return `
      LEFT JOIN ${this.jsonTable(
        source,
        fieldList,
        isArray
      )} as ${alias} ON 1=1`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string,
    fieldList: DialectFieldList
  ): string {
    return this.jsonTable(sourceSQLExpression, fieldList, isSingleton);
  }

  sqlSumDistinctHashedKey(_sqlDistinctKey: string): string {
    return 'UNUSED';
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    const sqlDistinctKey = `CONCAT(${key}, '')`;
    const upperPart = `CAST(CONV(SUBSTRING(MD5(${sqlDistinctKey}), 1, 16), 16, 10) AS DECIMAL(65, 0)) * 4294967296`;
    const lowerPart = `CAST(CONV(SUBSTRING(MD5(${sqlDistinctKey}), 16, 8), 16, 10) AS DECIMAL(65, 0))`;
    const hashkey = `(${upperPart} + ${lowerPart})`;
    const v = `COALESCE(${value},0)`;
    const sqlSum = `(SUM(DISTINCT ${hashkey} + ${v}) - SUM(DISTINCT ${hashkey}))`;
    if (funcName === 'SUM') {
      return sqlSum;
    } else if (funcName === 'AVG') {
      return `(${sqlSum})/NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END),0)`;
    }
    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  sqlGenerateUUID(): string {
    // TODO: This causes the query to become slow, figure out another way to make UUID deterministic.
    return 'CONCAT(ROW_NUMBER() OVER(), UUID())';
  }

  sqlFieldReference(
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string {
    if (parentType === 'array[scalar]' || parentType === 'record') {
      let ret = `JSON_UNQUOTE(JSON_EXTRACT(${parentAlias},'$.${childName}'))`;
      if (parentType === 'array[scalar]') {
        ret = `JSON_UNQUOTE(${parentAlias}.\`value\`)`;
      }
      switch (childType) {
        case 'string':
          return `CONCAT(${ret}, '')`;
        case 'number':
          return `CAST(${ret} as double)`;
        case 'record':
        case 'array':
          return `CAST(${ret} as JSON)`;
      }
    }
    const child = this.sqlMaybeQuoteIdentifier(childName);
    return `${parentAlias}.${child}`;
  }

  sqlCreateFunction(id: string, funcText: string): string {
    // TODO:
    return `CREATE FUNCTION ${id}(JSONB) RETURNS JSONB AS $$\n${indent(
      funcText
    )}\n$$ LANGUAGE SQL;\n`;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    // TODO:
    return `SELECT ARRAY((SELECT AS STRUCT * FROM ${lastStageName}))\n`;
  }

  sqlSelectAliasAsStruct(_alias: string, _fieldList: DialectFieldList) {
    return 'MYSQL: Implement this';
    // return `JSON_OBJECT(${physicalFieldNames
    //   .map(name => `'${name.replace(/`/g, '')}', \`${alias}\`.${name}`)
    //   .join(',')})`;
  }

  sqlMaybeQuoteIdentifier(identifier: string): string {
    return '`' + identifier.replace(/`/g, '``') + '`';
  }

  // TODO: Check what this is.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented Yet');
  }

  sqlNowExpr(): string {
    return 'LOCALTIMESTAMP';
  }

  // truncToUnit(sql, unit: string): string {
  //   return `EXTRACT(${unit} FROM ${sql})`;
  // }
  sqlTruncExpr(qi: QueryInfo, trunc: TimeTruncExpr): string {
    // LTNOTE: how come this can be undefined?
    let truncThis = trunc.e.sql || 'why could this be undefined';
    if (trunc.units === 'week') {
      truncThis = `DATE_SUB(${truncThis}, INTERVAL DAYOFWEEK(${truncThis}) - 1 DAY)`;
    }
    if (TD.isTimestamp(trunc.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        const civilSource = `(CONVERT_TZ(${truncThis}, 'UTC','${tz}'))`;
        const civilTrunc = `${this.truncToUnit(civilSource, trunc.units)}`;
        const truncTsTz = `CONVERT_TZ(${civilTrunc}, '${tz}', 'UTC')`;
        return `(${truncTsTz})`; // TODO: should it cast?
      }
    }
    const result = `${this.truncToUnit(truncThis, trunc.units)}`;
    return result;
  }

  truncToUnit(expr: string, units: string) {
    let format = "'%Y-%m-%d %H:%i:%s'";
    switch (units) {
      case 'minute':
        format = "'%Y-%m-%d %H:%i:00'";
        break;
      case 'hour':
        format = "'%Y-%m-%d %H:00:00'";
        break;
      case 'day':
      case 'week':
        format = "'%Y-%m-%d 00:00:00'";
        break;
      case 'month':
        format = "'%Y-%m-01 00:00:00'";
        break;
      case 'quarter':
        format = `CASE WHEN MONTH(${expr}) > 9 THEN '%Y-10-01 00:00:00' WHEN MONTH(${expr}) > 6 THEN '%Y-07-01 00:00:00' WHEN MONTH(${expr}) > 3 THEN '%Y-04-01 00:00:00' ELSE '%Y-01-01 00:00:00' end`;
        break;
      case 'year':
        format = "'%Y-01-01 00:00:00'";
        break;
    }

    return `TIMESTAMP(DATE_FORMAT(${expr}, ${format}))`;
  }

  sqlTimeExtractExpr(qi: QueryInfo, te: TimeExtractExpr): string {
    const msUnits = msExtractionMap[te.units] || te.units;
    let extractFrom = te.e.sql;
    if (TD.isTimestamp(te.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        extractFrom = `CONVERT_TZ(${extractFrom}, 'UTC', '${tz}')`;
      }
    }
    return `${msUnits}(${extractFrom})`;
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
    const interval = `INTERVAL ${n} ${timeframe} `;
    return `(${df.kids.base.sql})${df.op}${interval}`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const srcSQL = cast.e.sql || 'internal-error-in-sql-generation';
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      return `CAST(CONVERT_TZ(${srcSQL}, 'UTC', '${tz}') AS DATE) `;
    } else if (op === 'date::timestamp' && tz) {
      return ` CONVERT_TZ(${srcSQL}, '${tz}', 'UTC')`;
    }
    if (!TD.eq(srcTypeDef, dstTypeDef)) {
      if (cast.safe) {
        throw new Error("Mysql dialect doesn't support Safe Cast");
      }
      if (TD.isString(dstTypeDef)) {
        return `CONCAT(${srcSQL}, '')`;
      }
      return `CAST(${srcSQL} AS ${dstSQLType})`;
    }
    return srcSQL;
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `REGEXP_LIKE(${df.kids.expr.sql}, ${df.kids.regex.sql})`;
  }

  sqlLiteralTime(qi: QueryInfo, lt: TimeLiteralNode): string {
    if (TD.isDate(lt.typeDef)) {
      return `DATE '${lt.literal}'`;
    }
    const tz = lt.timezone || qtz(qi);
    if (tz) {
      return ` CONVERT_TZ('${lt.literal}', '${tz}', 'UTC')`;
    }
    return `TIMESTAMP '${lt.literal}'`;
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    let lVal = df.kids.left.sql;
    let rVal = df.kids.right.sql;
    if (inSeconds[df.units]) {
      lVal = `UNIX_TIMESTAMP(${lVal})`;
      rVal = `UNIX_TIMESTAMP(${rVal})`;
      const duration = `${rVal}-${lVal}`;
      return df.units === 'second'
        ? `FLOOR(${duration})`
        : `FLOOR((${duration})/${inSeconds[df.units].toString()}.0)`;
    }
    throw new Error(`Unknown or unhandled MySQL time unit: ${df.units}`);
  }

  sqlAggDistinct(
    _key: string,
    _values: string[],
    _func: (valNames: string[]) => string
  ): string {
    throw new Error('MySQL dialect does not support nesting.');
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} ORDER BY rand() LIMIT ${sample.rows} )`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM (SELECT ROW_NUMBER() OVER (ORDER BY rand()) as __row_number, __source_tbl.* from ${tableSQL} as __source_tbl) as __rand_tbl where __row_number % FLOOR(100.0 / ${sample.percent}) = 1)`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms
      .map(
        t =>
          `${t.trim().slice(0, t.trim().lastIndexOf(' '))} IS NULL DESC, ${t}`
      )
      .join(',')}`;
  }

  sqlLiteralString(literal: string): string {
    const noVirgule = literal.replace(/\\/g, '\\\\');
    return "'" + noVirgule.replace(/'/g, "\\'") + "'";
  }

  sqlLiteralRegexp(literal: string): string {
    return "'" + literal.replace(/'/g, "''") + "'";
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(MYSQL_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(MYSQL_DIALECT_FUNCTIONS);
  }

  mapFieldsForJsonObject(fieldList: DialectFieldList, nullValues?: boolean) {
    return fieldList
      .map(
        f =>
          `${f.sqlOutputName.replace(/`/g, "'")}, ${
            nullValues ? 'NULL' : f.sqlExpression
          }\n`
      )
      .join(', ');
  }

  castToString(expression: string): string {
    return `CONCAT(${expression}, '')`;
  }

  concat(...values: string[]): string {
    return `CONCAT(${values.join(',')})`;
  }
  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces,
    // Parentheses, Commas:  NUMERIC(5, 2)
    return sqlType.match(/^[A-Za-z\s(),0-9]*$/) !== null;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return `JSON_ARRAY(${array.join(',')})`;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const pairs = Object.entries(lit.kids).map(
      ([propName, propVal]) =>
        `${this.sqlLiteralString(propName)},${propVal.sql}`
    );
    return `JSON_OBJECT(${pairs.join(', ')})`;
  }
}
