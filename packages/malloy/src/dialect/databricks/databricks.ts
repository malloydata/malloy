import {
  Dialect,
  DialectFieldList,
  FieldReferenceType,
  QueryInfo,
  qtz,
} from '../dialect';
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
  BasicAtomicTypeDef,
  RecordLiteralNode,
  ArrayLiteralNode,
  RegexMatchExpr,
  TimeExtractExpr,
  TimeLiteralNode,
  TimeTruncExpr,
  TD,
} from '../../model/malloy_types';
import {
  DialectFunctionOverloadDef,
  expandOverrideMap,
  expandBlueprintMap,
} from '../functions';
import {DATABRICKS_MALLOY_STANDARD_OVERLOADS} from './function_overrides';
import {DATABRICKS_DIALECT_FUNCTIONS} from './dialect_functions';

const inSeconds: Record<string, number> = {
  'second': 1,
  'minute': 60,
  'hour': 3600,
  'day': 24 * 3600,
  'week': 7 * 24 * 3600,
};

const extractionMap: Record<string, string> = {
  'day_of_week': 'dayofweek',
  'day_of_year': 'doy',
};

const databricksToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'character varying': {type: 'string'},
  'name': {type: 'string'},
  'string': {type: 'string'},
  'date': {type: 'date'},
  'int': {type: 'number', numberType: 'integer'},
  'bigint': {type: 'number', numberType: 'integer'},
  'double': {type: 'number', numberType: 'float'},
  'decimal': {type: 'number', numberType: 'float'},
  'timestamp_ntz': {type: 'timestamp'}, // maybe not
  'boolean': {type: 'boolean'},
  'timestamp': {type: 'timestamp'},
  'smallint': {type: 'number', numberType: 'integer'},
  'interval': {type: 'string'},
  'varchar': {type: 'string'},
  'variant': {type: 'json'},
};

export class DatabricksDialect extends Dialect {
  name = 'databricks';
  defaultNumberType = 'BIGINT';
  defaultDecimalType = 'DECIMAL';
  udfPrefix = 'pg_temp.__udf';
  hasFinalStage = false;
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
  readsNestedData = false;
  supportsComplexFilteredSources = false;
  compoundObjectInSchema = false;
  supportsPipelinesInViews = false;
  quoteTablePath(tablePath: string): string {
    return tablePath
      .split('.')
      .map(part => `${part}`)
      .join('.');
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT EXPLODE(SEQUENCE(0,${groupSetCount},1)) as group_set)`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `GET((ARRAY_AGG(${fieldName}) FILTER (WHERE group_set=${groupSet} AND ${fieldName} IS NOT NULL)),0)`;
  }

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

  asNamesToSQLNames(fieldList: DialectFieldList): Record<string, string> {
    return Object.fromEntries(
      fieldList.map(f => [
        f.sqlExpression.replace(/`/g, ''),
        f.sqlOutputName.replace(/`/g, ''),
      ])
    );
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined,
  ): string {
    let fields = this.mapFields(fieldList);

    // Parse orderBy if provided to get column and direction
    if (orderBy) {
      const orderMatch = orderBy.match(
        /ORDER BY\s+(?:(?:[^`\s.]+\.)?`?([^`\s]+)`?)\s*(asc|desc)?/i
      );
      if (orderMatch) {
        const [, orderColumn, direction] = orderMatch;
        // Find the matching field and move it to front of struct
        const orderedFields = fieldList.reduce(
          (acc: DialectFieldList, field) => {
            // Compare against rawName since sqlOutputName includes __1 suffix
            if (field.sqlExpression.replace(/`/g, '') === orderColumn) {
              acc.unshift(field);
            } else {
              acc.push(field);
            }
            return acc;
          },
          []
        );
        fields = this.mapFields(orderedFields);
        // "as" names to original col names
        const sqlNames = this.asNamesToSQLNames(orderedFields);
        const isDesc = direction?.toLowerCase() === 'desc';
        const aggClause = `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END)`;
        let result = `COALESCE(${aggClause}, ARRAY())`;

        // Extract column name after dot if present
        const pureColumnName = orderColumn.includes('.')
          ? orderColumn.split('.')[1]
          : orderColumn;
        // use original col name if available
        const sqlName = sqlNames[pureColumnName] ?? pureColumnName;

        let lambda = `(x, y) -> CASE WHEN x.${sqlName} = y.${sqlName} THEN 0 WHEN x.${sqlName} < y.${sqlName} THEN 1 ELSE -1 END`;
        if (!isDesc) {
          lambda = `(x, y) -> CASE WHEN x.${sqlName} = y.${sqlName} THEN 0 WHEN x.${sqlName} < y.${sqlName} THEN -1 ELSE 1 END`;
        }
        result = `ARRAY_SORT(${result}, ${lambda})`;

        return result;
      }
    }

    // If no valid orderBy, proceed with original logic
    const aggClause = `ARRAY_AGG(CASE WHEN group_set=${groupSet} THEN STRUCT(${fields}) END)`;
    let result = `COALESCE(${aggClause}, ARRAY())`;
    return result;
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
    return `GET((ARRAY_AGG(${name}) FILTER (WHERE group_set=${groupSet} AND ${name} IS NOT NULL)),0) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = this.mapFields(fieldList);
    return `TO_JSONB((ARRAY_AGG((SELECT __x FROM (SELECT ${fields}) as __x)) FILTER (WHERE group_set=${groupSet}))[1])`;
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(DATABRICKS_DIALECT_FUNCTIONS);
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
        return `LATERAL VIEW posexplode_outer(${source}) ${alias} AS __row_id, ${alias}`;
      } else {
        return `LATERAL VIEW posexplode_outer(${source}) ${alias} AS __row_id, ${alias}`;
      }
    } else if (needDistinctKey) {
      return `LATERAL VIEW posexplode_outer(${source}) ${alias} AS __row_id, ${alias}`; // distinct
    } else {
      return `LATERAL VIEW posexplode_outer(${source}) ${alias} AS __row_id, ${alias}`;
    }
  }

  sqlSumDistinctHashedKey(sqlDistinctKey: string): string {
    return `unhex(md5(${sqlDistinctKey}))`;
  }

  sqlGenerateUUID(): string {
    return 'uuid()';
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `${df.kids.expr.sql} RLIKE ${df.kids.regex.sql}`;
  }

  sqlFieldReference(
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    childType: string
  ): string {
    if (childName === '__row_id') {
      return `${parentAlias}.${childName}`;
    }
    if (parentType === 'array[scalar]') {
      return `${parentAlias}`;
    }
    // For non-table parents, use map/array access
    if (parentType !== 'table') {
      const fieldReference = `${parentAlias}.${childName}`;
      let ret = fieldReference;

      switch (childType) {
        case 'string':
          break;
        case 'number':
          ret = `CAST(${fieldReference} AS DOUBLE)`;
          break;
        case 'struct':
        case 'record':
        case 'array[record]':
          ret = fieldReference;
          break;
      }
      return ret;
    } else {
      // For table parents, keep using dot notation with proper quoting
      const child = this.sqlMaybeQuoteIdentifier(childName);
      return `${parentAlias}.${child}`;
    }
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    // console.log('literal record', lit);
    // console.log('typedef', JSON.stringify(lit.typeDef, null, 2));
    const ents: string[] = [];
    for (const [name, val] of Object.entries(lit.kids)) {
      const expr = val.sql || 'internal-error-literal-record';
      ents.push(`'${name}', ${expr}`);
    }
    return `named_struct(${ents.join(',')})`;
  }

  sqlLiteralArray(lit: ArrayLiteralNode): string {
    const array = lit.kids.values.map(val => val.sql);
    return `array(${array.join(',')})`;
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    if (isSingleton) {
      return `(SELECT ${sourceSQLExpression})`;
    } else {
      return `EXPLODE(${sourceSQLExpression})`;
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
    return `SELECT to_json(struct(*)) AS row FROM ${lastStageName}`;
  }

  sqlSelectAliasAsStruct(alias: string): string {
    return `ROW(${alias})`; // todo
  }

  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented Yet');
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    const lVal = from.sql;
    const rVal = to.sql;
    if (inSeconds[df.units]) {
      return `datediff(${df.units}, ${lVal}, ${rVal})`;
    }
    throw new Error(`Unknown or unhandled databricks time unit: ${df.units}`);
  }

  sqlAlterTimeExpr(df: TimeDeltaExpr): string {
    let timeframe = df.units;
    let n = df.kids.delta.sql;

    // Handle quarter and week conversions
    if (timeframe === 'quarter') {
      timeframe = 'month';
      n = `(${n}*3)`;
    } else if (timeframe === 'week') {
      timeframe = 'day';
      n = `(${n}*7)`;
    }

    return `DATEADD(${timeframe}, ${n}${df.op === '+' ? '' : '*-1'}, ${
      df.kids.base.sql
    })`;
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    // In Spark SQL, we can use the same functions: concat, md5, substring, conv, etc.
    // Create a distinct key expression by converting the key to a string.
    const sqlDistinctKey = `concat(${key}, '')`;

    // Compute the hash key in two parts.
    // The first part: take the first 16 characters of the MD5 hash, convert from hexadecimal to decimal,
    // cast to DECIMAL(38,0) and multiply by 4294967296.
    const upperPart = `CAST(conv(substring(md5(${sqlDistinctKey}), 1, 16), 16, 10) AS DECIMAL(38,0)) * 4294967296`;

    // The second part: take the next 8 characters of the MD5 hash and convert them similarly.
    const lowerPart = `CAST(conv(substring(md5(${sqlDistinctKey}), 16, 8), 16, 10) AS DECIMAL(38,0))`;

    // The full hash key is the sum of both parts.
    const hashKey = `(${upperPart} + ${lowerPart})`;

    // Ensure the value is not null.
    const v = `COALESCE(${value}, 0)`;

    // The symmetric distinct SUM is computed as:
    //   SUM(DISTINCT (hashKey + value)) - SUM(DISTINCT hashKey)
    const sqlSum = `(SUM(DISTINCT ${hashKey} + ${v}) - SUM(DISTINCT ${hashKey}))`;

    // Return the appropriate SQL expression based on the aggregation function.
    if (funcName.toUpperCase() === 'SUM') {
      return sqlSum;
    } else if (funcName.toUpperCase() === 'AVG') {
      // For the AVG case, divide the sum by the distinct count of non-null keys.
      return `(${sqlSum}) / NULLIF(COUNT(DISTINCT CASE WHEN ${value} IS NOT NULL THEN ${key} END), 0)`;
    }

    throw new Error(`Unknown Symmetric Aggregate function ${funcName}`);
  }

  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
    return `(
      SELECT ${func(
        values.map((v, i) => `get_json_object(a.value, '$.val${i}')`)
      )} as value
      FROM (
        SELECT ARRAY_AGG(DISTINCT to_json(named_struct('key', ${key}, ${values
          .map((v, i) => `'val${i}', ${v}`)
          .join(', ')}))) as arr
      ) t
      LATERAL VIEW EXPLODE(t.arr) a AS value
    )`;
  }

  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE(${sample.rows} ROWS))`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} TABLESAMPLE(${sample.percent} PERCENT))`;
      }
    }
    return tableSQL;
  }

  sqlOrderBy(orderTerms: string[]): string {
    return `ORDER BY ${orderTerms.map(t => `${t} NULLS LAST`).join(',')}`;
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
    return expandOverrideMap(DATABRICKS_MALLOY_STANDARD_OVERLOADS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'integer';
      } else {
        return 'double';
      }
    } else if (malloyType.type === 'string') {
      return 'string';
    }
    return malloyType.type;
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    // Remove trailing params
    const baseSqlType = sqlType.match(/^([\w\s]+)/)?.at(0) ?? sqlType;
    return (
      databricksToMalloyTypes[baseSqlType.trim().toLowerCase()] ?? {
        type: 'sql native',
        rawType: sqlType,
      }
    );
  }

  castToString(expression: string): string {
    return `CAST(${expression} as STRING)`;
  }

  concat(...values: string[]): string {
    return 'CONCAT(' + values.join(',') + ')';
  }

  validateTypeName(sqlType: string): boolean {
    // Letters:              BIGINT
    // Numbers:              INT8
    // Spaces:               TIMESTAMP WITH TIME ZONE
    // Parentheses, Commas:  NUMERIC(5, 2)
    // Square Brackets:      INT64[]
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }

  sqlMaybeQuoteIdentifier(ident: string): string {
    return `\`${ident}\``;
  }

  sqlNowExpr(): string {
    return 'CURRENT_TIMESTAMP()';
  }

  sqlTruncExpr(qi: QueryInfo, toTrunc: TimeTruncExpr): string {
    // adjusting for sunday/monday weeks
    const week = toTrunc.units === 'week';
    const truncThis = week ? `DATE_ADD(${toTrunc.e.sql}, 1)` : toTrunc.e.sql;
    if (TD.isTimestamp(toTrunc.e.typeDef)) {
      const tz = qtz(qi);
      if (tz) {
        return `DATE_TRUNC('${toTrunc.units}', from_utc_timestamp(${truncThis}, '${tz}'))`;
      }
    }
    let result = `DATE_TRUNC('${toTrunc.units}', ${truncThis})`;
    if (week) {
      result = `DATE_SUB(${result}, 1)`;
    }
    return result;
  }

  sqlTimeExtractExpr(qi: QueryInfo, from: TimeExtractExpr): string {
    // convert from utc
    // we're probly getting this in utc time, convert to local time
    // since that's what the cx expects us to return
    const queryTZ = qtz(qi);
    let extractFrom = from.e.sql;
    // if we have user's local time, convert from utc to their time
    if (queryTZ) {
      extractFrom = `from_utc_timestamp(${from.e.sql}, '${queryTZ}')`;
    }

    // return `EXTRACT(${extractionMap[from.units] || from.units} FROM ${from.e.sql})`;
    return `EXTRACT(${
      extractionMap[from.units] || from.units
    } FROM (${extractFrom}))`;
  }

  sqlLiteralTime(qi: QueryInfo, lt: TimeLiteralNode): string {
    if (TD.isDate(lt.typeDef)) {
      return `DATE '${lt.literal}'`;
    }
    const tz = lt.timezone || qtz(qi);
    if (tz) {
      return `to_utc_timestamp(timestamp'${lt.literal}', '${tz}')`;
    }
    return `timestamp '${lt.literal}'`;
  }

  sqlCast(qi: QueryInfo, cast: TypecastExpr): string {
    const src = cast.e.sql || '';
    const {op, srcTypeDef, dstTypeDef, dstSQLType} = this.sqlCastPrep(cast);

    if (TD.eq(srcTypeDef, dstTypeDef)) {
      return src;
    }

    // Databricks doesn't have a TRY_CAST equivalent, so we'll need to handle safe casting differently
    if (cast.safe) {
      // For safe casting in Databricks, we can use a CASE statement to handle NULL and invalid casts
      return `CASE
        WHEN ${src} IS NULL THEN NULL
        WHEN TRY_CAST(${src} AS ${dstSQLType}) IS NOT NULL THEN CAST(${src} AS ${dstSQLType})
        ELSE NULL
      END`;
    }

    // Handle special timestamp and date casting cases
    if (op === 'timestamp::date') {
      return `DATE(${src})`;
    } else if (op === 'date::timestamp') {
      const queryTZ = qtz(qi);
      if (queryTZ) {
        // convert to utc time
        return `to_utc_timestamp(TIMESTAMP(${src}), '${queryTZ}')`;
      }
      return `TIMESTAMP(${src})`;
    }

    // Default case - standard CAST
    return `CAST(${src} AS ${dstSQLType})`;
  }
}
