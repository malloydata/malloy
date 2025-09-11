/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * TestSelect - Generate dialect-specific SQL from JavaScript objects for testing
 *
 * Usage:
 *   const testSelect = new TestSelect(dialect);
 *   const userSQL = testSelect.generate([
 *     {id: testSelect.mk_bigint(1), name: "bob", score: testSelect.mk_float(85.5)},
 *     {id: testSelect.mk_bigint(2), name: "alice", score: testSelect.mk_float(92.0)}
 *   ]);
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

// Value with a known type
interface TypedValue {
  expr: Expr;
  malloyType: AtomicTypeDef;
  needsCast?: boolean;
}

// Valid value types for inferrable types
type PrimitiveValue = string | number | boolean | null | undefined;

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
        node: 'timeLiteral',
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
        node: 'timeLiteral',
        literal: value,
        typeDef: {type: 'timestamp'},
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

    // Collect all column names from all rows
    const allColumns = new Set<string>();
    for (const row of rows) {
      for (const colName of Object.keys(row)) {
        allColumns.add(colName);
      }
    }

    // Generate SELECT statements
    const selects = rows.map((row, idx) => {
      const fields: string[] = [];

      for (const colName of allColumns) {
        const value = row[colName] ?? null;
        const typedValue = this.toTypedValue(value);
        const sql = this.exprToSQL(typedValue.expr);
        const quotedName = this.dialect.sqlMaybeQuoteIdentifier(colName);

        if (idx === 0) {
          // First row: include column aliases and explicit casts if needed
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

      return `SELECT ${fields.join(', ')}`;
    });

    return selects.join('\nUNION ALL ') + '\n';
  }

  // ============= Private helper methods =============

  private toTypedValue(value: TestValue): TypedValue {
    // If already typed, return it
    if (this.isTypedValue(value)) {
      return value;
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      // Default to string type for bare nulls
      return this.mk_string(null);
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

    if (typeof value === 'object') {
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

/*
Example usage:

const testSelect = new TestSelect(dialect);

const userSQL = testSelect.generate([
  {
    id: testSelect.mk_int(1),
    name: "bob",
    email: "bob@example.com",
    score: testSelect.mk_float(85.5),
    is_active: testSelect.mk_bool(true),
    created_at: testSelect.mk_timestamp('2024-01-15 14:30:00'),
    signup_date: testSelect.mk_date('2024-01-15'),
    tags: ["admin", "user"],  // Inferred as array
    settings: {                // Inferred as record
      theme: "dark",
      notifications: true
    }
  },
  {
    id: testSelect.mk_int(2),
    name: "alice",
    email: testSelect.mk_string(null),  // Typed NULL
    score: testSelect.mk_float(92.0),
    is_active: testSelect.mk_bool(false),
    created_at: testSelect.mk_timestamp('2024-01-16 09:00:00'),
    signup_date: testSelect.mk_date('2024-01-16'),
    tags: ["user"],
    settings: {
      theme: "light",
      notifications: false
    }
  }
]);

const orderSQL = testSelect.generate([
  {
    id: 1,  // Inferred as integer
    user_id: testSelect.mk_int(1),
    amount: 99.99,  // Inferred as float
    status: "pending",
    items: [
      {sku: "ABC", qty: 2, price: 10.00},
      {sku: "DEF", qty: 1, price: 20.00}
    ]
  }
]);

// Use in Malloy:
const malloySource = `
  source: users is duckdb.sql("""${userSQL}""")
  source: orders is duckdb.sql("""${orderSQL}""")
`;
*/
