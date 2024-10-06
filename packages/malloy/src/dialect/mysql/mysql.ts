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
  Dialect,
  DialectFieldList,
  QueryInfo,
  qtz,
  DialectFunctionOverloadDef,
} from '..';
import {
  indent,
  Sampling,
  isSamplingEnable,
  isSamplingRows,
  isSamplingPercent,
  MeasureTimeExpr,
  TimeLiteralNode,
  RegexMatchExpr,
  TimeDeltaExpr,
  TimeTruncExpr,
  TimeExtractExpr,
  TypecastExpr,
  FieldAtomicTypeDef,
} from '../../model';

const castMap: Record<string, string> = {
  number: 'double precision',
  string: 'varchar(255)',
};

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

const mysqlToMalloyTypes: {[key: string]: FieldAtomicTypeDef} = {
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
  // TODO: this may not be enough for lager casts.
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
  experimental = true;
  nativeBoolean = false;
  supportsFullJoin = false;
  supportsPipelinesInViews = false;
  readsNestedData = false;

  malloyTypeToSQLType(malloyType: FieldAtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'BIGINT';
      } else {
        return 'DOUBLE';
      }
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): FieldAtomicTypeDef | undefined {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^(\w+)/)?.at(0) ?? sqlType;
    return mysqlToMalloyTypes[baseSqlType.toLowerCase()];
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
    gc = `JSON_EXTRACT(CONCAT('[',${gc},']'),'$')`;
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
    } else return t;
  }
  unnestColumns(fieldList: DialectFieldList) {
    const fields: string[] = [];
    for (const f of fieldList) {
      fields.push(
        `${f.sqlOutputName} ${this.malloyToSQL(f.type)} PATH "$.${f.rawName}"`
      );
    }
    return fields.join(',\n');
  }

  jsonTable(source: string, fieldList: DialectFieldList): string {
    return `JSON_TABLE(${source}, '$[*]'
        COLUMNS (
          __row_id FOR ORDINALITY,
          ${this.unnestColumns(fieldList)}
        )
      )`;
  }

  // LTNOTE: We'll make this work with Arrays once MToy's changes land.
  sqlUnnestAlias(
    source: string,
    alias: string,
    fieldList: DialectFieldList,
    _needDistinctKey: boolean,
    _isArray: boolean,
    _isInNestedPipeline: boolean
  ): string {
    return `
      LEFT JOIN ${this.jsonTable(source, fieldList)} as ${alias} ON 1=1`;
  }

  sqlUnnestPipelineHead(
    _isSingleton: boolean,
    sourceSQLExpression: string,
    fieldList: DialectFieldList
  ): string {
    return this.jsonTable(sourceSQLExpression, fieldList);
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
    alias: string,
    fieldName: string,
    fieldType: string,
    isNested: boolean,
    _isArray: boolean
  ): string {
    let ret = `${alias}.\`${fieldName}\``;
    if (isNested) {
      switch (fieldType) {
        case 'string':
          ret = `CONCAT(${ret}, '')`;
          break;
        // TODO: Fix this.
        case 'number':
          ret = `CAST(${ret} as double)`;
          break;
        case 'struct':
          ret = `CAST(${ret} as JSON)`;
          break;
      }
      return ret;
    } else {
      return `${alias}.\`${fieldName}\``;
    }
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
    return `\`${identifier}\``;
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
    if (trunc.e.dataType === 'timestamp') {
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
    if (te.e.dataType === 'timestamp') {
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
    const op = `${cast.srcType}::${cast.dstType}`;
    const tz = qtz(qi);
    if (op === 'timestamp::date' && tz) {
      return `CAST(CONVERT_TZ(${cast.e.sql}, 'UTC', '${tz}') AS DATE) `;
    } else if (op === 'date::timestamp' && tz) {
      return ` CONVERT_TZ(${cast.e.sql}, '${tz}', 'UTC')`;
    }
    if (cast.srcType !== cast.dstType) {
      const dstType =
        typeof cast.dstType === 'string'
          ? castMap[cast.dstType]
          : cast.dstType.raw;
      if (cast.safe) {
        throw new Error("Mysql dialect doesn't support Safe Cast");
      }
      if (cast.dstType === 'string') {
        return `CONCAT(${cast.e.sql}, '')`;
      }
      return `CAST(${cast.e.sql}  AS ${dstType})`;
    }
    // LTNOTE: I don't understand how this could be undefined.
    return cast.e.sql || 'weirdly undefined';
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `REGEXP_LIKE(${df.kids.expr.sql}, ${df.kids.regex.sql})`;
  }

  sqlLiteralTime(qi: QueryInfo, lt: TimeLiteralNode): string {
    if (lt.dataType === 'date') {
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
    return {};
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return {};
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
}
