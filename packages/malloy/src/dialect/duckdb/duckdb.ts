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

import type {
  Sampling,
  AtomicTypeDef,
  RegexMatchExpr,
  MeasureTimeExpr,
  BasicAtomicTypeDef,
  RecordLiteralNode,
  OrderBy,
  TimestampUnit,
} from '../../model/malloy_types';
import {
  isSamplingEnable,
  isSamplingPercent,
  isSamplingRows,
  TD,
  mkFieldDef,
} from '../../model/malloy_types';
import {indent} from '../../model/utils';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandOverrideMap, expandBlueprintMap} from '../functions';
import type {
  DialectFieldList,
  FieldReferenceType,
  IntegerTypeMapping,
} from '../dialect';
import {inDays, MIN_INT32, MAX_INT32, MIN_INT128, MAX_INT128} from '../dialect';
import {PostgresBase} from '../pg_impl';
import {DUCKDB_DIALECT_FUNCTIONS} from './dialect_functions';
import {DUCKDB_MALLOY_STANDARD_OVERLOADS} from './function_overrides';
import type {TinyToken} from '../tiny_parser';
import {TinyParseError, TinyParser} from '../tiny_parser';

// need to refactor runSQL to take a SQLBlock instead of just a sql string.
const hackSplitComment = '-- hack: split on this';

const duckDBToMalloyTypes: {[key: string]: BasicAtomicTypeDef} = {
  'BIGINT': {type: 'number', numberType: 'bigint'},
  'INTEGER': {type: 'number', numberType: 'integer'},
  'TINYINT': {type: 'number', numberType: 'integer'},
  'SMALLINT': {type: 'number', numberType: 'integer'},
  'UBIGINT': {type: 'number', numberType: 'bigint'},
  'UINTEGER': {type: 'number', numberType: 'integer'},
  'UTINYINT': {type: 'number', numberType: 'integer'},
  'USMALLINT': {type: 'number', numberType: 'integer'},
  'HUGEINT': {type: 'number', numberType: 'bigint'},
  'UHUGEINT': {type: 'number', numberType: 'bigint'},
  'DOUBLE': {type: 'number', numberType: 'float'},
  'FLOAT': {type: 'number', numberType: 'float'},
  'VARCHAR': {type: 'string'},
  'DATE': {type: 'date'},
  'TIMESTAMP': {type: 'timestamp'},
  'TIME': {type: 'string'},
  'DECIMAL': {type: 'number', numberType: 'float'},
  'BOOLEAN': {type: 'boolean'},
};

export class DuckDBDialect extends PostgresBase {
  name = 'duckdb';
  experimental = false;
  defaultNumberType = 'DOUBLE';
  defaultDecimalType = 'NUMERIC';
  hasFinalStage = false;
  divisionIsInteger = true;
  supportsSumDistinctFunction = true;
  unnestWithNumbers = false;
  defaultSampling = {rows: 50000};
  supportUnnestArrayAgg = true;
  supportsAggDistinct = true;
  supportsCTEinCoorelatedSubQueries = true;
  dontUnionIndex = true;
  supportsQualify = true;
  supportsSafeCast = true;
  supportsNesting = true;
  supportsCountApprox = true;

  // DuckDB UNNEST in LATERAL JOINs doesn't preserve array element order
  requiresExplicitUnnestOrdering = true;

  // DuckDB: 32-bit INTEGER is safe, larger integers need bigint
  override integerTypeMappings: IntegerTypeMapping[] = [
    {min: BigInt(MIN_INT32), max: BigInt(MAX_INT32), numberType: 'integer'},
    {min: MIN_INT128, max: MAX_INT128, numberType: 'bigint'},
  ];

  // hack until they support temporary macros.
  get udfPrefix(): string {
    return `__udf${Math.floor(Math.random() * 100000)}`;
  }

  quoteTablePath(tableName: string): string {
    // Quote if contains special chars that could be SQL injection or need quoting
    return tableName.match(/[/*:;-]/) ? `'${tableName}'` : tableName;
  }

  sqlGroupSetTable(groupSetCount: number): string {
    return `CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0,${groupSetCount},1)) as group_set  ) as group_set`;
  }

  sqlAnyValue(groupSet: number, fieldName: string): string {
    return `FIRST(${fieldName}) FILTER (WHERE ${fieldName} IS NOT NULL)`;
  }

  // DuckDB WASM has an issue with returning invalid DecimalBigNum
  // values unless we explicitly cast to DOUBLE
  override sqlLiteralNumber(literal: string): string {
    return literal.includes('.')
      ? `${literal}::${this.defaultNumberType}`
      : literal;
  }

  mapFields(fieldList: DialectFieldList): string {
    return fieldList.join(', ');
  }

  sqlAggregateTurtle(
    groupSet: number,
    fieldList: DialectFieldList,
    orderBy: string | undefined
  ): string {
    const fields = fieldList
      .map(f => `\n  ${f.sqlOutputName}: ${f.sqlExpression}`)
      .join(', ');
    return `COALESCE(LIST({${fields}} ${orderBy}) FILTER (WHERE group_set=${groupSet}),[])`;
  }

  sqlAnyValueTurtle(groupSet: number, fieldList: DialectFieldList): string {
    const fields = fieldList
      .map(f => `${f.sqlOutputName}:=${f.sqlExpression}`)
      .join(', ');
    return `ANY_VALUE(CASE WHEN group_set=${groupSet} THEN STRUCT_PACK(${fields}) END)`;
  }

  sqlAnyValueLastTurtle(
    name: string,
    groupSet: number,
    sqlName: string
  ): string {
    return `MAX(CASE WHEN group_set=${groupSet} THEN ${name} END) as ${sqlName}`;
  }

  sqlCoaleseMeasuresInline(
    groupSet: number,
    fieldList: DialectFieldList
  ): string {
    const fields = fieldList
      .map(f => `${f.sqlOutputName}: ${f.sqlExpression} `)
      .join(', ');
    const nullValues = fieldList
      .map(f => `${f.sqlOutputName}: NULL`)
      .join(', ');

    return `COALESCE(FIRST({${fields}}) FILTER(WHERE group_set=${groupSet}), {${nullValues}})`;
  }

  // sqlUnnestAlias(
  //   source: string,
  //   alias: string,
  //   _fieldList: DialectFieldList,
  //   _needDistinctKey: boolean
  // ): string {
  //   return `LEFT JOIN (select UNNEST(generate_series(1,
  //       100000, --
  //       -- (SELECT genres_length FROM movies limit 1),
  //       1)) as __row_id) as ${alias} ON  ${alias}.__row_id <= array_length(${source})`;
  //   // When DuckDB supports lateral joins...
  //   //return `,(select UNNEST(generate_series(1, length(${source}),1))) as ${alias}(__row_id)`;
  // }

  sqlUnnestAlias(
    source: string,
    alias: string,
    _fieldList: DialectFieldList,
    _needDistinctKey: boolean,
    _isArray: boolean,
    isInNestedPipeline: boolean
  ): string {
    if (this.unnestWithNumbers) {
      // Duckdb can't unnest in a coorelated subquery at the moment so we hack it.
      const arrayLen = isInNestedPipeline
        ? '100000'
        : `array_length(${source})`;
      return `LEFT JOIN (select UNNEST(generate_series(1,
        ${arrayLen},
        1)) as __row_id) as ${alias} ON  ${alias}.__row_id <= array_length(${source})`;
    }
    // Use WITH ORDINALITY to preserve array element order via __row_id
    return `LEFT JOIN LATERAL UNNEST(${source}) WITH ORDINALITY as ${alias}_outer(${alias}, __row_id) ON true`;
  }

  sqlSumDistinctHashedKey(_sqlDistinctKey: string): string {
    return 'uses sumDistinctFunction, should not be called';
  }

  sqlGenerateUUID(): string {
    return 'GEN_RANDOM_UUID()';
  }

  sqlDateToString(sqlDateExp: string): string {
    return `(${sqlDateExp})::date::varchar`;
  }

  sqlFieldReference(
    parentAlias: string,
    parentType: FieldReferenceType,
    childName: string,
    _childType: string
  ): string {
    // LTNOTE: hack, in duckdb we can't have structs as tables so we kind of simulate it.
    if (!this.unnestWithNumbers && childName === '__row_id') {
      return `${parentAlias}_outer.__row_id`;
    } else if (parentType === 'array[scalar]') {
      return parentAlias;
    } else {
      return `${parentAlias}.${this.sqlMaybeQuoteIdentifier(childName)}`;
    }
  }

  sqlUnnestPipelineHead(
    isSingleton: boolean,
    sourceSQLExpression: string
  ): string {
    let p = sourceSQLExpression;
    if (isSingleton) {
      p = `[${p}]`;
    }
    return `(SELECT UNNEST(${p}) as base)`;
  }

  sqlCreateFunction(id: string, funcText: string): string {
    return `DROP MACRO IF EXISTS ${id}; \n${hackSplitComment}\n CREATE MACRO ${id}(_param) AS (\n${indent(
      funcText
    )}\n);\n${hackSplitComment}\n`;
  }

  sqlCreateFunctionCombineLastStage(
    lastStageName: string,
    dialectFieldList: DialectFieldList,
    orderBy: OrderBy[] | undefined
  ): string {
    let o = '';
    if (orderBy) {
      const clauses: string[] = [];
      for (const c of orderBy) {
        if (typeof c.field === 'string') {
          clauses.push(`${c.field} ${c.dir || 'asc'}`);
        } else {
          clauses.push(
            `${dialectFieldList[c.field].sqlOutputName} ${c.dir || 'asc'}`
          );
        }
      }
      if (clauses.length > 0) {
        o = ` ORDER BY ${clauses.join(', ')}`;
      }
    }
    return `SELECT LIST(STRUCT_PACK(${dialectFieldList
      .map(d => this.sqlMaybeQuoteIdentifier(d.sqlOutputName))
      .join(',')})${o}) FROM ${lastStageName}\n`;
  }

  sqlSelectAliasAsStruct(
    alias: string,
    dialectFieldList: DialectFieldList
  ): string {
    return `STRUCT_PACK(${dialectFieldList
      .map(d => `${alias}.${d.sqlOutputName}`)
      .join(', ')})`;
  }

  // The simple way to do this is to add a comment on the table
  //  with the expiration time. https://www.postgresql.org/docs/current/sql-comment.html
  //  and have a reaper that read comments.
  sqlCreateTableAsSelect(_tableName: string, _sql: string): string {
    throw new Error('Not implemented Yet');
  }

  sqlSumDistinct(key: string, value: string, funcName: string): string {
    // return `sum_distinct(list({key:${key}, val: ${value}}))`;
    return `(
      SELECT ${funcName}(a.val) as value
      FROM (
        SELECT UNNEST(list(distinct {key:${key}, val: ${value}})) a
      )
    )`;
  }

  sqlAggDistinct(
    key: string,
    values: string[],
    func: (valNames: string[]) => string
  ): string {
    return `(
      SELECT ${func(values.map((v, i) => `a.val${i}`))} as value
      FROM (
        SELECT UNNEST(list(distinct {key:${key}, ${values
          .map((v, i) => `val${i}: ${v}`)
          .join(',')}})) a
      )
    )`;
  }

  // sqlSumDistinct(key: string, value: string): string {
  //   const _factor = 32;
  //   const precision = 0.000001;
  //   const keySQL = `md5_number_lower(${key}::varchar)::int128`;
  //   return `
  //   (SUM(DISTINCT ${keySQL} + FLOOR(IFNULL(${value},0)/${precision})::int128) -  SUM(DISTINCT ${keySQL}))*${precision}
  //   `;
  // }

  // default duckdb to sampling 50K rows.
  sqlSampleTable(tableSQL: string, sample: Sampling | undefined): string {
    if (sample !== undefined) {
      if (isSamplingEnable(sample) && sample.enable) {
        sample = this.defaultSampling;
      }
      if (isSamplingRows(sample)) {
        return `(SELECT * FROM ${tableSQL} USING SAMPLE ${sample.rows})`;
      } else if (isSamplingPercent(sample)) {
        return `(SELECT * FROM ${tableSQL} USING SAMPLE ${sample.percent} PERCENT (bernoulli))`;
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

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(DUCKDB_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(DUCKDB_DIALECT_FUNCTIONS);
  }

  malloyTypeToSQLType(malloyType: AtomicTypeDef): string {
    if (malloyType.type === 'number') {
      if (malloyType.numberType === 'integer') {
        return 'integer';
      } else if (malloyType.numberType === 'bigint') {
        return 'hugeint';
      } else {
        return 'double precision';
      }
    } else if (malloyType.type === 'string') {
      return 'varchar';
    }
    if (malloyType.type === 'timestamptz') {
      return 'timestamp with time zone';
    }
    return malloyType.type;
  }

  parseDuckDBType(sqlType: string): AtomicTypeDef {
    const parser = new DuckDBTypeParser(sqlType);
    try {
      return parser.typeDef();
    } catch (e) {
      if (e instanceof TinyParseError) {
        return {type: 'sql native', rawType: sqlType};
      } else {
        throw e;
      }
    }
  }

  sqlTypeToMalloyType(rawSqlType: string): BasicAtomicTypeDef {
    const sqlType = rawSqlType.toUpperCase();
    if (sqlType === 'TIMESTAMP WITH TIME ZONE') {
      return {type: 'timestamptz'};
    }
    // Remove decimal precision
    const ddbType = sqlType.replace(/^DECIMAL\(\d+,\d+\)/g, 'DECIMAL');
    // Remove trailing params
    const baseSqlType = ddbType.match(/^(\w+)/)?.at(0) ?? ddbType;
    return (
      duckDBToMalloyTypes[baseSqlType.toUpperCase()] ?? {
        type: 'sql native',
        rawType: sqlType.toLowerCase(),
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
    // Parentheses, Commas:  DECIMAL(1, 1)
    // Brackets:             INT[ ]
    return sqlType.match(/^[A-Za-z\s(),[\]0-9]*$/) !== null;
  }

  sqlOffsetTime(
    expr: string,
    op: '+' | '-',
    magnitude: string,
    unit: TimestampUnit,
    _typeDef: AtomicTypeDef,
    _inCivilTime: boolean,
    _timezone?: string
  ): string {
    // DuckDB doesn't support INTERVAL '1' WEEK, convert to days
    let offsetUnit = unit;
    let offsetMag = magnitude;
    if (unit === 'week') {
      offsetUnit = 'day';
      offsetMag = `(${magnitude})*7`;
    }

    const interval = `INTERVAL (${offsetMag}) ${offsetUnit}`;
    return `(${expr} ${op} ${interval})`;
  }

  sqlRegexpMatch(df: RegexMatchExpr): string {
    return `REGEXP_MATCHES(${df.kids.expr.sql},${df.kids.regex.sql})`;
  }

  sqlMeasureTimeExpr(df: MeasureTimeExpr): string {
    const from = df.kids.left;
    const to = df.kids.right;
    let lVal = from.sql || '';
    let rVal = to.sql || '';
    if (!inDays(df.units)) {
      if (TD.isDate(from.typeDef)) {
        lVal = `${lVal}::TIMESTAMP`;
      }
      if (TD.isDate(to.typeDef)) {
        rVal = `${rVal}::TIMESTAMP`;
      }
    }
    return `DATE_SUB('${df.units}', ${lVal}, ${rVal})`;
  }

  sqlLiteralRecord(lit: RecordLiteralNode): string {
    const pairs = Object.entries(lit.kids).map(
      ([propName, propVal]) =>
        `${this.sqlMaybeQuoteIdentifier(propName)}:${propVal.sql}`
    );
    return '{' + pairs.join(',') + '}';
  }
}

class DuckDBTypeParser extends TinyParser {
  constructor(input: string) {
    super(input, {
      /* whitespace           */ space: /^\s+/,
      /* single quoted string */ qsingle: /^'([^']|'')*'/,
      /* double quoted string */ qdouble: /^"([^"]|"")*"/,
      /* (n) size             */ size: /^\(\d+\)/,
      /* (n1,n2) precision    */ precision: /^\(\d+,\d+\)/,
      /* T[] -> array of T    */ arrayOf: /^\[]/,
      /* other punctuation    */ char: /^[,:[\]()-]/,
      /* unquoted word        */ id: /^\w+/,
    });
  }

  unquoteName(token: TinyToken): string {
    if (token.type === 'qsingle') {
      return token.text.replace("''", '');
    } else if (token.type === 'qdouble') {
      return token.text.replace('""', '');
    }
    return token.text;
  }

  sqlID(token: TinyToken) {
    return token.text.toUpperCase();
  }

  typeDef(): AtomicTypeDef {
    const wantID = this.next('id');
    const id = this.sqlID(wantID);
    let baseType: AtomicTypeDef;
    if (id === 'VARCHAR') {
      if (this.peek().type === 'size') {
        this.next();
      }
    }
    if (
      (id === 'DECIMAL' || id === 'NUMERIC') &&
      this.peek().type === 'precision'
    ) {
      this.next();
      baseType = {type: 'number', numberType: 'float'};
    } else if (id === 'TIMESTAMP') {
      if (this.peek().text.toUpperCase() === 'WITH') {
        this.nextText('WITH', 'TIME', 'ZONE');
        baseType = {type: 'timestamptz'};
      } else {
        baseType = {type: 'timestamp'};
      }
    } else if (duckDBToMalloyTypes[id]) {
      baseType = duckDBToMalloyTypes[id];
    } else if (id === 'STRUCT') {
      this.next('(');
      baseType = {type: 'record', fields: []};
      for (;;) {
        const fieldName = this.next();
        if (
          fieldName.type === 'qsingle' ||
          fieldName.type === 'qdouble' ||
          fieldName.type === 'id'
        ) {
          const fieldType = this.typeDef();
          baseType.fields.push(
            mkFieldDef(fieldType, this.unquoteName(fieldName))
          );
        } else {
          if (fieldName.type !== ')') {
            throw this.parseError('Expected identifier or ) to end STRUCT');
          }
          break;
        }
        if (this.peek().type === ',') {
          this.next();
        }
      }
    } else {
      if (wantID.type === 'id') {
        // unknown field type, strip all type decorations, there was a regex for this
        // in the pre-parser code, but no tests, so this is also untested
        let idEnd = wantID.cursor + wantID.text.length;
        if (this.peek().type === 'precision') {
          this.next();
        }
        if (this.peek().type === 'eof') {
          idEnd = this.input.length;
        }
        baseType = {
          type: 'sql native',
          rawType: this.input.slice(wantID.cursor, idEnd),
        };
      } else {
        throw this.parseError('Could not understand type');
      }
    }
    while (this.peek().type === 'arrayOf') {
      this.next();
      if (baseType.type === 'record') {
        baseType = {
          type: 'array',
          elementTypeDef: {type: 'record_element'},
          fields: baseType.fields,
        };
      } else {
        baseType = {
          type: 'array',
          elementTypeDef: baseType,
        };
      }
    }
    return baseType;
  }
}
