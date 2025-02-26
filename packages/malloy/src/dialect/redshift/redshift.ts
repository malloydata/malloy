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
  AtomicTypeDef,
  TimeDeltaExpr,
  TypecastExpr,
  MeasureTimeExpr,
  LeafAtomicTypeDef,
  RecordLiteralNode,
  ArrayLiteralNode,
  TimeLiteralNode,
  TD,
  TimeTruncExpr,
} from '../../model/malloy_types';
import {
  DialectFunctionOverloadDef,
  expandOverrideMap,
  expandBlueprintMap,
} from '../functions';
import {DialectFieldList, FieldReferenceType, qtz, QueryInfo} from '../dialect';
import {PostgresBase} from '../pg_impl';
import {POSTGRES_DIALECT_FUNCTIONS} from './dialect_functions';
import {REDSHIFT_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

const pgMakeIntervalMap: Record<string, string> = {
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

const postgresToMalloyTypes: {[key: string]: LeafAtomicTypeDef} = {
  'smallint': {type: 'number', numberType: 'integer'},
  'integer': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'decimal': {type: 'number', numberType: 'float'},
  'real': {type: 'number', numberType: 'float'},
  'double precision': {type: 'number', numberType: 'float'},
  'char': {type: 'string'},
  'varchar': {type: 'string'},
  'date': {type: 'date'},
  'time': {type: 'timestamp'}, //?
  'timetz': {type: 'timestamp'}, //?
  'timestamp': {type: 'timestamp'},
  'timestamp without time zone': {type: 'timestamp'},
  'timestamptz': {type: 'timestamp'}, // maybe not
  'interval year to month': {type: 'string'}, //?
  'interval day to second': {type: 'string'}, //?
  'boolean': {type: 'boolean'},
  'hllsketch': {type: 'string'}, //?
  'super': {type: 'string'}, //?
  'varbyte': {type: 'string'}, //?
  'geography': {type: 'string'}, //?
  'geometry': {type: 'string'}, //?
  'character varying': {type: 'string'},
};

export class RedshiftDialect extends PostgresBase {
  name = 'redshift';
  defaultNumberType = 'DOUBLE PRECISION';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = 'pg_temp.__udf';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = false;
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
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  compoundObjectInSchema = false;

  quoteTablePath(tablePath: string): string {
    return tablePath
      .split('.')
      .map(part => `"${part}"`)
      .join('.');
  }

  sqlGroupSetTable(groupSetCount: number): string {
    /*
      generate_series(0,n) is not supported in redshift, so we need to do a workaround:
        CROSS JOIN (
          SELECT 0 AS n
          UNION ALL SELECT 1
          UNION ALL SELECT 2
          UNION ALL SELECT 3
      ) AS group_set
    */

    return `CROSS JOIN (
      SELECT 0 AS group_set
      ${Array.from(
        {length: groupSetCount},
        (_, i) => `UNION ALL SELECT ${i + 1}`
      ).join('\n      ')}
    )`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `MAX(${fieldName})`;
  }

  mapFields(fieldList: DialectFieldList): string {
    return fieldList
      .map(
        f =>
          `\n  ${f.sqlExpression}${
            f.type === 'number' ? `::${this.defaultNumberType}` : ''
          } as ${f.sqlOutputName}`
        //`${f.sqlExpression} ${f.type} as ${f.sqlOutputName}`
      )
      .join(', ');
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
    const fields = this.mapFields(fieldList);
    return `JSON_PARSE(LISTAGG(CASE WHEN group_set=${groupSet} THEN JSON_SERIALIZE(OBJECT(${fieldList
      .map(f => `'${f.rawName}', ${f.sqlExpression}`)
      .join(',')})) END IGNORE NULLS))`;
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
    return `MAX(CASE WHEN group_set = ${groupSet} THEN ${name} END) AS ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = this.mapFields(fieldList);
    return `TO_JSONB((ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x)) FILTER (WHERE group_set=${groupSet}))[1])`;
  }

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
        return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('__row_id', row_number() over (), 'value', v) FROM JSONB_ARRAY_ELEMENTS(TO_JSONB(${source})) as v))) as ${alias} ON true`;
      } else {
        return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('value', v) FROM JSONB_ARRAY_ELEMENTS(TO_JSONB(${source})) as v))) as ${alias} ON true`;
      }
    } else if (needDistinctKey) {
      return `LEFT JOIN UNNEST(ARRAY((SELECT jsonb_build_object('__row_number', row_number() over())|| __xx::jsonb as b FROM  JSONB_ARRAY_ELEMENTS(${source}) __xx ))) as ${alias} ON true`;
    } else {
      // can already access data fine so just keep original table
      return `, __stage1 as ${alias}`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    // Convert the key to a string if it isn't already
    const stringKey = `CAST(${sqlDistinctKey} AS VARCHAR)`;

    // Get MD5 hash of the key as a hex string
    const md5Hash = `MD5(${stringKey})`;

    // Take first 16 chars of hash for upper part and next 8 chars for lower part
    const upperPart = `STRTOL(SUBSTRING(${md5Hash}, 1, 15), 16)::DECIMAL(38,0) * 4294967296`;
    const lowerPart = `STRTOL(SUBSTRING(${md5Hash}, 17, 8), 16)::DECIMAL(38,0)`;

    // Combine parts to create final hash value
    return `(${upperPart} + ${lowerPart})`;
  }

  sqlGenerateUUID(): string {
    return `SUBSTRING(MD5(RANDOM()::text || current_timestamp::text), 1, 8) || '-' ||
      SUBSTRING(MD5(RANDOM()::text || current_timestamp::text), 9, 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::text || current_timestamp::text), 13, 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::text || current_timestamp::text), 17, 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::text || current_timestamp::text), 21, 12)`;
  }

  sqlFieldReference(
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string {
    if (childName === '__row_id') {
      return `(${parentAlias}->>'__row_id')`;
    }
    if (parentType !== 'table') {
      let ret = `JSONB_EXTRACT_PATH_TEXT(${parentAlias},'${childName}')`;
      ret = `${parentAlias}.${childName}`;
      switch (childType) {
        case 'string':
          break;
        case 'number':
          ret = `${ret}::double precision`;
          break;
        case 'struct':
        case 'array':
        case 'record':
        case 'array[record]':
          ret = `JSONB_EXTRACT_PATH(${parentAlias},'${childName}')`;
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
    if (isSingleton) {
      return `UNNEST(ARRAY((SELECT ${sourceSQLExpression})))`;
    } else {
      return `JSONB_ARRAY_ELEMENTS(${sourceSQLExpression})`;
    }
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `CREATE FUNCTION ${id}(JSONB) RETURNS JSONB AS $$\n${indent(
      funcText
    )}\n$$ LANGUAGE SQL;\n`;
  }

  sqlCreateFunctionCombineLastStage(lastStageName: string): string {
    return `SELECT JSONB_AGG(__stage0) FROM ${lastStageName}\n`;
  }

  sqlFinalStage(lastStageName: string, _fields: string[]): string {
    return `SELECT row_to_json(finalStage) as row FROM ${lastStageName} AS finalStage`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `ROW(${alias})`;
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented Yet');
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

    return `DATEADD(${pgMakeIntervalMap[timeframe]}, (${n}${
      df.op === '+' ? '' : '*-1'
    })::INT, (${df.kids.base.sql})::TIMESTAMP)`;
  }
  // todo
  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    if (cast.safe) {
      throw new Error("Postgres dialect doesn't support Safe Cast");
    }
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);

    if (op === 'boolean::string') {
      const expr = cast.e.sql || '';
      return `CASE WHEN ${expr} THEN 'true' ELSE 'false' END`;
    }

    const result = super.sqlCast(qi, cast);

    return result;
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    let lVal = from.sql;
    let rVal = to.sql;
    if (inSeconds[df.units]) {
      lVal = `EXTRACT(EPOCH FROM ${lVal})`;
      rVal = `EXTRACT(EPOCH FROM ${rVal})`;
      const duration = `${rVal}-${lVal}`;
      return df.units === 'second'
        ? `FLOOR(${duration})`
        : `FLOOR((${duration})/${inSeconds[df.units].toString()}.0)`;
    }
    throw new Error(`Unknown or unhandled postgres time unit: ${df.units}`);
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    // return `sum_distinct(list({key:${key}, val: ${value}}))`;
    return `(
      SELECT ${funcName}((a::json->>'f2')::DOUBLE PRECISION) as value
      FROM (
        SELECT UNNEST(array_agg(distinct row_to_json(row(${key},${value}))::text)) a
      ) a
    )`;
  }

  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
    return `(
      SELECT ${func(values.map((v, i) => `(a::json->>'f${i + 2}')`))} as value
      FROM (
        SELECT UNNEST(array_agg(distinct row_to_json(row(${key},${values.join(
          ','
        )}))::text)) a
      ) a
    )`;
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} ORDER BY RANDOM() LIMIT ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} WHERE RANDOM() < ${sample.percent})`;
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

  sqlLiteralTime(qi: QueryInfo, lt: TimeLiteralNode): string {
    if (TD.isDate(lt.typeDef)) {
      return `DATE '${lt.literal}'`;
    }
    const tz = lt.timezone || qtz(qi);
    if (tz) {
      return `CONVERT_TIMEZONE('${tz}', 'UTC', '${lt.literal}')`;
    }
    return `'${lt.literal}' AT TIME ZONE 'UTC'`;
  }

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(REDSHIFT_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(POSTGRES_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
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

  sqlTypeToMalloyType(sqlType: string): LeafAtomicTypeDef {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    return (
      postgresToMalloyTypes[baseSqlType.trim().toLowerCase()] ?? {
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

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces:               TIMESTAMP WITH TIME ZONE
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Square Brackets:      INT64[]
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const props: string[] = [];
    for (const [kName, kVal] of Object.entries(lit.kids)) {
      props.push(`'${kName}',${kVal.sql}`);
    }
    return `JSONB_BUILD_OBJECT(${props.join(', ')})`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return 'JSONB_BUILD_ARRAY(' + array.join(',') + ')';
  }
}
