/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Dialect,
  QueryInfo,
  AtomicTypeDef,
  ArrayLiteralNode,
  RecordLiteralNode,
  Expr,
  TypecastExpr,
  FieldDef,
} from '@malloydata/malloy';

import {constantExprToSQL, mkFieldDef} from '@malloydata/malloy';

interface TypedValue {
  expr: Expr;
  malloyType: AtomicTypeDef;
  needsCast?: boolean;
}

// Valid value types for inferrable types
type PrimitiveValue = string | number | boolean | null;

// Test data value types
type TestValue =
  | PrimitiveValue
  | TestValue[]
  | {[key: string]: TestValue}
  | TypedValue;

const nullExpr: Expr = {node: 'null'};

interface TestDataRow {
  [columnName: string]: TestValue;
}

/**
 * TestSelect - Generate dialect-specific SQL test data from JavaScript objects
 *
 * TestSelect provides a simple, type-safe way to generate SQL SELECT statements
 * that produce test data across different SQL dialects. It handles dialect-specific
 * differences in literal syntax, type casting, and complex types (arrays/records).
 *
 * @example Basic usage with inferred types
 * ```typescript
 * const ts = new TestSelect(dialect);
 * const sql = ts.generate(
 *   {id: 1, name: "Alice", active: true},
 *   {id: 2, name: "Bob", active: false}
 * );
 * // Generates: SELECT 1 AS "id", 'Alice' AS "name", true AS "active"
 * //           UNION ALL SELECT 2, 'Bob', false
 * ```
 *
 * @example Explicit type hints for precision
 * ```typescript
 * const sql = ts.generate({
 *   id: ts.mk_int(1),
 *   score: ts.mk_float(95.5),    // Forces float type (gets CAST)
 *   name: ts.mk_string("Test"),
 *   active: ts.mk_bool(true),
 *   created: ts.mk_timestamp('2024-01-15 10:30:00'),
 *   birthday: ts.mk_date('1990-05-20')
 * });
 * ```
 *
 * @example Handling NULL values with proper typing
 * ```typescript
 * const sql = ts.generate({
 *   id: ts.mk_int(1),
 *   email: ts.mk_string(null),    // Typed NULL - generates CAST(NULL AS VARCHAR)
 *   score: ts.mk_float(null)      // Typed NULL - generates CAST(NULL AS FLOAT)
 * });
 * ```
 *
 * @example Arrays and records (for dialects that support them)
 * ```typescript
 * const sql = ts.generate({
 *   tags: ['red', 'blue', 'green'],              // Inferred array
 *   scores: ts.mk_array([85, 90, 95]),          // Explicit array
 *   address: {street: '123 Main', city: 'NYC'}, // Inferred record
 *   user: ts.mk_record({                        // Explicit record
 *     name: ts.mk_string('Alice'),
 *     age: ts.mk_int(30)
 *   })
 * });
 * ```
 *
 * @example Arrays of records (repeated records in Malloy)
 * ```typescript
 * const sql = ts.generate({
 *   orders: [
 *     {item: 'Widget', qty: 5, price: 10.00},
 *     {item: 'Gadget', qty: 2, price: 25.00}
 *   ]
 * });
 * ```
 *
 * Type inference rules:
 * - JavaScript number → INTEGER if whole number, FLOAT if decimal
 * - JavaScript string → VARCHAR/TEXT (dialect decides)
 * - JavaScript boolean → BOOLEAN
 * - JavaScript Date → TIMESTAMP
 * - JavaScript array → ARRAY (if supported by dialect)
 * - JavaScript object → RECORD/STRUCT (if supported by dialect)
 * - null/undefined → defaults to STRING type (use mk_* functions for typed nulls)
 *
 * CAST behavior:
 * - NULLs always get CAST to ensure proper typing
 * - Floats always get CAST to ensure they're treated as floating point
 * - Other types generally don't need CAST (dialect handles conversion)
 *
 * Important notes:
 * - First row determines column types when using inference
 * - Use mk_* functions for nulls in first row to ensure correct types
 * - Not all dialects support arrays and records
 * - Timestamps are generated in UTC by default
 * - Large integers can be passed as strings: mk_int('9223372036854775807')
 *
 * @param dialect - The SQL dialect to generate for (from Malloy)
 * @param queryTimezone - Timezone for timestamp literals (default: 'UTC')
 */
export class TestSelect {
  private qi: QueryInfo;

  constructor(
    private dialect: Dialect,
    queryTimezone = 'UTC'
  ) {
    this.qi = {queryTimezone};
  }

  // ============= Type hint methods =============

  mk_int(value: number | string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'number', numberType: 'integer'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'number', numberType: 'integer'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: {
        node: 'numberLiteral',
        literal: String(value),
      },
      malloyType,
      needsCast: false,
    };
  }

  mk_bigint(value: number | string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'number', numberType: 'bigint'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'number', numberType: 'bigint'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: {
        node: 'numberLiteral',
        literal: String(value),
      },
      malloyType,
      needsCast: true, // bigint needs cast to ensure proper type
    };
  }

  mk_float(value: number | string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'number', numberType: 'float'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'number', numberType: 'float'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: {
        node: 'numberLiteral',
        literal: String(value),
      },
      malloyType,
      needsCast: true, // floats always need cast
    };
  }

  mk_string(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'string'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'string'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: {
        node: 'stringLiteral',
        literal: value,
      },
      malloyType,
      needsCast: false,
    };
  }

  mk_bool(value: boolean | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'boolean'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'boolean'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: value ? {node: 'true'} : {node: 'false'},
      malloyType,
      needsCast: false,
    };
  }

  mk_date(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'date'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'date'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: {
        node: 'dateLiteral',
        literal: value,
        typeDef: {type: 'date'},
      },
      malloyType,
      needsCast: false,
    };
  }

  mk_timestamp(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'timestamp'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'timestamp'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    return {
      expr: {
        node: 'timestampLiteral',
        literal: value,
        typeDef: {type: 'timestamp'},
      },
      malloyType,
      needsCast: false,
    };
  }

  mk_timestamptz(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'timestamptz'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'timestamptz'},
        safe: false,
      };

      return {
        expr: castExpr,
        malloyType,
        needsCast: true,
      };
    }

    const match = value.match(/^(.+?)\s*\[(.+?)\]$/);
    if (!match) {
      throw new Error(`Invalid timestamptz format: ${value}. Expected format: 'YYYY-MM-DD
  HH:MM:SS [Timezone]'`);
    }
    const [, ts, timezone] = match;
    return {
      expr: {
        node: 'timestamptzLiteral',
        literal: ts.trim(),
        typeDef: {type: 'timestamptz'},
        timezone,
      },
      malloyType,
      needsCast: false,
    };
  }

  mk_array(values: TestValue[]): TypedValue {
    if (values.length === 0) {
      throw new Error(
        'Cannot create empty array - need at least one element to infer type'
      );
    }

    // Convert all values to TypedValues
    const typedValues = values.map(v => this.toTypedValue(v));
    const firstElement = typedValues[0];

    // Check if it's an array of records (repeated record)
    if (firstElement.malloyType.type === 'record') {
      // For repeated records, Malloy uses a special structure
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

  mk_record(value: Record<string, TestValue>): TypedValue {
    const kids: Record<string, Expr> = {};
    const fields: FieldDef[] = []; // Explicitly type the array

    for (const [key, val] of Object.entries(value)) {
      const typed = this.toTypedValue(val);
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

  // ============= Main generation method =============

  /**
   * Generate SQL from test data rows
   */
  generate(...rows: TestDataRow[]): string {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('generate() requires a non-empty array of rows');
    }

    // Collect all column names from all rows (preserving order from first occurrence)
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
    // Two reasons to quote a column name, neither matter here:
    // 1) snowflake uppercases unquoted names
    // 2) it is a reserved word in the dialect
    const rowIdColumn = '__ts_n__';

    // Generate SELECT statements
    const selects = rows.map((row, idx) => {
      const fields: string[] = [];

      for (const colName of columnList) {
        const value = row[colName] ?? null;
        const typedValue = this.toTypedValue(value);
        const sql = this.exprToSQL(typedValue.expr);

        if (idx === 0) {
          // First row: include column aliases and explicit casts if needed
          const quotedName = this.dialect.sqlMaybeQuoteIdentifier(colName);
          if (typedValue.needsCast) {
            const sqlType = this.dialect.malloyTypeToSQLType(
              typedValue.malloyType
            );
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

    // Multiple rows: double wrap - inner for sorting, outer for column selection
    const quotedColumns = columnList
      .map(col => this.dialect.sqlMaybeQuoteIdentifier(col))
      .join(', ');
    const innerQuery = selects.join('\nUNION ALL ');

    // Generate ORDER BY based on dialect preference
    let orderByClause: string;
    if (this.dialect.orderByClause === 'ordinal') {
      // ORDER BY position (column count + 1 since row_id is last)
      orderByClause = `ORDER BY ${columnList.length + 1}`;
    } else if (this.dialect.orderByClause === 'output_name') {
      // ORDER BY column name
      orderByClause = `ORDER BY ${rowIdColumn}`;
    } else {
      // ORDER BY expression - just use column name (qualified would be t_sorted.__ts_row_id__)
      orderByClause = `ORDER BY ${rowIdColumn}`;
    }
    // Presto/Trino ignores ORDER BY on a subquery without LIMIT
    orderByClause += ` LIMIT ${rows.length}`;

    const sql = `SELECT ${quotedColumns}\nFROM (\n  SELECT *\n  FROM (\n${innerQuery}\n  ) AS t_sorted\n  ${orderByClause}\n) AS t_result\n`;

    return sql;
  }

  // ============= Private helper methods =============

  private toTypedValue(value: TestValue): TypedValue {
    // If already typed, return it
    if (this.isTypedValue(value)) {
      return value;
    }

    // Handle null/undefined
    if (value === null) {
      return {
        expr: nullExpr,
        malloyType: {type: 'sql native'}, // to ensure a cast happens
        needsCast: true,
      };
    }

    // Infer from JavaScript type
    if (typeof value === 'string') {
      return this.mk_string(value);
    }

    if (typeof value === 'boolean') {
      return this.mk_bool(value);
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return this.mk_int(value);
      } else {
        return this.mk_float(value);
      }
    }

    if (Array.isArray(value)) {
      return this.mk_array(value);
    }

    if (typeof value === 'object' && Object.keys(value).length > 0) {
      return this.mk_record(value);
    }

    throw new Error(`Cannot convert value to TypedValue: ${value}`);
  }

  private exprToSQL(expr: Expr): string {
    const result = constantExprToSQL(expr, this.dialect, {});
    if (result.sql) {
      return result.sql;
    }
    if (result.error) {
      throw new Error(`Failed to generate SQL: ${result.error}`);
    }
    throw new Error(`Error in SQL generation for ${JSON.stringify(expr)}`);
  }

  private isTypedValue(value: unknown): value is TypedValue {
    return (
      value !== null &&
      typeof value === 'object' &&
      'expr' in value &&
      'malloyType' in value
    );
  }
}
