/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  SingleConnectionRuntime,
  ModelMaterializer,
  Dialect,
  Expr,
  FieldDef,
  ArrayLiteralNode,
  RecordLiteralNode,
} from '..';
import {constantExprToSQL, mkFieldDef} from '..';
import type {TypedValue} from './test-values';

/**
 * A test model combines a ModelMaterializer with the dialect used to create it.
 * This allows matchers to handle dialect-specific behaviors like simulated booleans.
 */
export interface TestModel {
  model: ModelMaterializer;
  dialect: Dialect;
}

// Valid value types for inferrable types
type PrimitiveValue = string | number | boolean | null;

// Test data value types - can be primitives, arrays, records, or explicit TypedValues
type TestValue =
  | PrimitiveValue
  | TestValue[]
  | {[key: string]: TestValue}
  | TypedValue;

interface TestDataRow {
  [columnName: string]: TestValue;
}

/**
 * Sources definition for mkTestModel.
 * Keys are source names, values are arrays of test data rows.
 */
export interface TestModelSources {
  [sourceName: string]: TestDataRow[];
}

const nullExpr: Expr = {node: 'null'};

/**
 * Check if a value is a TypedValue (explicit type hint from TV).
 */
function isTypedValue(value: unknown): value is TypedValue {
  return (
    value !== null &&
    typeof value === 'object' &&
    'expr' in value &&
    'malloyType' in value
  );
}

/**
 * Convert a test value to a TypedValue with type information.
 */
function toTypedValue(value: TestValue): TypedValue {
  // If already typed, return it
  if (isTypedValue(value)) {
    return value;
  }

  // Handle null/undefined - default to string type
  if (value === null) {
    return {
      expr: nullExpr,
      malloyType: {type: 'sql native'}, // ensures a cast happens
      needsCast: true,
    };
  }

  // Infer from JavaScript type
  if (typeof value === 'string') {
    return {
      expr: {node: 'stringLiteral', literal: value},
      malloyType: {type: 'string'},
      needsCast: false,
    };
  }

  if (typeof value === 'boolean') {
    return {
      expr: value ? {node: 'true'} : {node: 'false'},
      malloyType: {type: 'boolean'},
      needsCast: false,
    };
  }

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return {
        expr: {node: 'numberLiteral', literal: String(value)},
        malloyType: {type: 'number', numberType: 'integer'},
        needsCast: false,
      };
    } else {
      return {
        expr: {node: 'numberLiteral', literal: String(value)},
        malloyType: {type: 'number', numberType: 'float'},
        needsCast: true, // floats always need cast
      };
    }
  }

  if (Array.isArray(value)) {
    return toTypedArray(value);
  }

  if (typeof value === 'object' && Object.keys(value).length > 0) {
    return toTypedRecord(value);
  }

  throw new Error(`Cannot convert value to TypedValue: ${value}`);
}

/**
 * Convert an array to a TypedValue.
 */
function toTypedArray(values: TestValue[]): TypedValue {
  if (values.length === 0) {
    throw new Error(
      'Cannot create empty array - need at least one element to infer type'
    );
  }

  const typedValues = values.map(v => toTypedValue(v));
  const firstElement = typedValues[0];

  // Check if it's an array of records (repeated record)
  if (firstElement.malloyType.type === 'record') {
    const recordType = firstElement.malloyType;
    if (!('fields' in recordType)) {
      throw new Error('Record type missing fields');
    }

    const arrayExpr: ArrayLiteralNode = {
      node: 'arrayLiteral',
      kids: {values: typedValues.map(tv => tv.expr)},
      typeDef: {
        type: 'array',
        elementTypeDef: {type: 'record_element'},
        fields: recordType.fields,
      },
    };

    return {
      expr: arrayExpr,
      malloyType: {
        type: 'array',
        elementTypeDef: {type: 'record_element'},
        fields: recordType.fields,
      },
      needsCast: false,
    };
  } else {
    // For basic arrays (non-record elements)
    const elementType = firstElement.malloyType;

    const arrayExpr: ArrayLiteralNode = {
      node: 'arrayLiteral',
      kids: {values: typedValues.map(tv => tv.expr)},
      typeDef: {type: 'array', elementTypeDef: elementType},
    };

    return {
      expr: arrayExpr,
      malloyType: {type: 'array', elementTypeDef: elementType},
      needsCast: false,
    };
  }
}

/**
 * Convert a record to a TypedValue.
 */
function toTypedRecord(value: Record<string, TestValue>): TypedValue {
  const kids: Record<string, Expr> = {};
  const fields: FieldDef[] = [];

  for (const [key, val] of Object.entries(value)) {
    const typed = toTypedValue(val);
    fields.push(mkFieldDef(typed.malloyType, key));
    kids[key] = typed.expr;
  }

  const recordExpr: RecordLiteralNode = {
    node: 'recordLiteral',
    kids,
    typeDef: {type: 'record', fields},
  };

  return {
    expr: recordExpr,
    malloyType: {type: 'record', fields},
    needsCast: false,
  };
}

/**
 * Convert an expression to SQL using the dialect.
 */
function exprToSQL(expr: Expr, dialect: Dialect): string {
  const result = constantExprToSQL(expr, dialect, {});
  if (result.sql) {
    return result.sql;
  }
  if (result.error) {
    throw new Error(`Failed to generate SQL: ${result.error}`);
  }
  throw new Error(`Error in SQL generation for ${JSON.stringify(expr)}`);
}

/**
 * Generate SQL SELECT statement for test data rows.
 */
function generateSQL(dialect: Dialect, rows: TestDataRow[]): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('generateSQL requires a non-empty array of rows');
  }

  // Collect all column names from all rows
  const columnList: string[] = [];
  const columnSet = new Set<string>();
  for (const row of rows) {
    for (const colName of Object.keys(row)) {
      if (!columnSet.has(colName)) {
        columnList.push(colName);
        columnSet.add(colName);
      }
    }
  }

  const needsOrdering = rows.length > 1;
  const rowIdColumn = '__ts_n__';

  // Generate SELECT statements
  const selects = rows.map((row, idx) => {
    const fields: string[] = [];

    for (const colName of columnList) {
      const value = row[colName] ?? null;
      const typedValue = toTypedValue(value);
      const sql = exprToSQL(typedValue.expr, dialect);

      if (idx === 0) {
        // First row: include column aliases and explicit casts if needed
        const quotedName = dialect.sqlMaybeQuoteIdentifier(colName);
        if (typedValue.needsCast) {
          const sqlType = dialect.malloyTypeToSQLType(typedValue.malloyType);
          fields.push(`CAST(${sql} AS ${sqlType}) AS ${quotedName}`);
        } else {
          fields.push(`${sql} AS ${quotedName}`);
        }
      } else {
        // Subsequent rows: just the values in same order
        fields.push(sql);
      }
    }

    // Add row ID at the end if we have multiple rows
    if (needsOrdering) {
      if (idx === 0) {
        fields.push(`${idx} AS ${rowIdColumn}`);
      } else {
        fields.push(`${idx}`);
      }
    }

    return `SELECT ${fields.join(', ')}`;
  });

  // Single row: just return the SELECT
  if (!needsOrdering) {
    return selects[0] + '\n';
  }

  // Multiple rows: wrap for sorting
  const quotedColumns = columnList
    .map(col => dialect.sqlMaybeQuoteIdentifier(col))
    .join(', ');
  const innerQuery = selects.join('\nUNION ALL ');

  // Generate ORDER BY based on dialect preference
  let orderByClause: string;
  if (dialect.orderByClause === 'ordinal') {
    orderByClause = `ORDER BY ${columnList.length + 1}`;
  } else if (dialect.orderByClause === 'output_name') {
    orderByClause = `ORDER BY ${rowIdColumn}`;
  } else {
    orderByClause = `ORDER BY ${rowIdColumn}`;
  }
  // Presto/Trino ignores ORDER BY on a subquery without LIMIT
  orderByClause += ` LIMIT ${rows.length}`;

  const sql = `SELECT ${quotedColumns}\nFROM (\n  SELECT *\n  FROM (\n${innerQuery}\n  ) AS t_sorted\n  ${orderByClause}\n) AS t_result\n`;

  return sql;
}

/**
 * Create a queryable model with test data sources.
 *
 * @example
 * import { mkTestModel, TV } from '@malloydata/malloy/test';
 *
 * const tm = mkTestModel(runtime, {
 *   users: [
 *     {id: TV.int(1), name: 'alice'},
 *     {id: TV.int(2), name: 'bob'}
 *   ],
 *   orders: [
 *     {user_id: TV.int(1), amount: 99.99}
 *   ]
 * });
 *
 * // Then in tests:
 * await expect('run: users -> { select: * }')
 *   .toMatchResult(tm, {id: 1, name: 'alice'}, {id: 2, name: 'bob'});
 *
 * @param runtime - SingleConnectionRuntime with dialect and connection info
 * @param sources - Object mapping source names to arrays of test data rows
 * @returns TestModel with the model and dialect
 */
export function mkTestModel(
  runtime: SingleConnectionRuntime,
  sources: TestModelSources
): TestModel {
  const dialect = runtime.dialect;
  const connectionName = runtime.connection.name;

  // Generate source definitions
  const sourceDefinitions: string[] = [];

  for (const [sourceName, rows] of Object.entries(sources)) {
    const sql = generateSQL(dialect, rows);
    // Escape backslashes first, then triple quotes for Malloy SQL block
    const escapedSql = sql.replace(/\\/g, '\\\\').replace(/"""/g, '\\"""');
    sourceDefinitions.push(
      `source: ${sourceName} is ${connectionName}.sql("""${escapedSql}""")`
    );
  }

  const modelText = sourceDefinitions.join('\n');
  return {
    model: runtime.loadModel(modelText),
    dialect,
  };
}

/**
 * Create a TestModel from a Malloy source string.
 * Use this when you want to load existing tables or custom Malloy definitions
 * and use them with the test matchers.
 *
 * @example
 * const tm = wrapTestModel(runtime, `
 *   source: users is ${db}.table('users')
 * `);
 * await expect('run: users -> { select: * }').toMatchResult(tm, {...});
 *
 * // Empty string for raw SQL queries:
 * const tm = wrapTestModel(runtime, '');
 * await expect(`run: ${db}.sql("""...""")`).toMatchResult(tm, {...});
 */
export function wrapTestModel(
  runtime: SingleConnectionRuntime,
  source: string
): TestModel {
  return {model: runtime.loadModel(source), dialect: runtime.dialect};
}

/**
 * Extend an existing TestModel with additional Malloy source.
 * Creates a new TestModel that includes both the base model's definitions
 * and the new source.
 *
 * @example
 * const base = wrapTestModel(runtime, 'source: users is ...');
 * const extended = extendTestModel(base, 'source: orders is ...');
 * // extended can now query both users and orders
 */
export function extendTestModel(base: TestModel, source: string): TestModel {
  return {model: base.model.extendModel(source), dialect: base.dialect};
}
