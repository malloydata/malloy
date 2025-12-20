/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AtomicTypeDef, Expr, TypecastExpr} from '..';

/**
 * TypedValue represents a value with explicit type information.
 * Used to specify types that can't be inferred from JavaScript values.
 */
export interface TypedValue {
  expr: Expr;
  malloyType: AtomicTypeDef;
  needsCast?: boolean;
}

const nullExpr: Expr = {node: 'null'};

/**
 * Test Values - type hint functions for test data.
 * Use these when type inference isn't sufficient (nulls, specific numeric types, temporals).
 *
 * @example
 * import { TV, mkTestModel } from '@malloydata/malloy/test';
 *
 * const model = mkTestModel(runtime, {
 *   users: [
 *     {id: TV.int(1), name: 'alice', created: TV.timestamp('2024-01-01 00:00:00')},
 *     {id: TV.int(2), name: null, created: TV.timestamp(null)}  // typed nulls
 *   ]
 * });
 */
export const TV = {
  /**
   * Create an integer value.
   * Use for explicit integer type or typed nulls.
   */
  int(value: number | string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'number', numberType: 'integer'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'number', numberType: 'integer'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    return {
      expr: {node: 'numberLiteral', literal: String(value)},
      malloyType,
      needsCast: false,
    };
  },

  /**
   * Create a float value.
   * Floats always need casting to ensure proper type.
   */
  float(value: number | string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'number', numberType: 'float'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'number', numberType: 'float'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    return {
      expr: {node: 'numberLiteral', literal: String(value)},
      malloyType,
      needsCast: true, // floats always need cast
    };
  },

  /**
   * Create a bigint value.
   * Use for explicit bigint type or typed nulls.
   */
  bigint(value: number | string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'number', numberType: 'bigint'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'number', numberType: 'bigint'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    return {
      expr: {node: 'numberLiteral', literal: String(value)},
      malloyType,
      needsCast: false,
    };
  },

  /**
   * Create a string value.
   * Use for typed nulls.
   */
  string(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'string'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'string'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    return {
      expr: {node: 'stringLiteral', literal: value},
      malloyType,
      needsCast: false,
    };
  },

  /**
   * Create a boolean value.
   * Use for typed nulls.
   */
  bool(value: boolean | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'boolean'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'boolean'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    return {
      expr: value ? {node: 'true'} : {node: 'false'},
      malloyType,
      needsCast: false,
    };
  },

  /**
   * Create a date value (date only, no time).
   * Format: 'YYYY-MM-DD'
   */
  date(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'date'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'date'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    return {
      expr: {node: 'dateLiteral', literal: value, typeDef: {type: 'date'}},
      malloyType,
      needsCast: false,
    };
  },

  /**
   * Create a timestamp value (date + time, no timezone).
   * Format: 'YYYY-MM-DD HH:MM:SS'
   */
  timestamp(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'timestamp'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'timestamp'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
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
  },

  /**
   * Create a timestamptz value (date + time + timezone).
   * Format: 'YYYY-MM-DD HH:MM:SS [Timezone]'
   */
  timestamptz(value: string | null): TypedValue {
    const malloyType: AtomicTypeDef = {type: 'timestamptz'};

    if (value === null) {
      const castExpr: TypecastExpr = {
        node: 'cast',
        e: nullExpr,
        dstType: {type: 'timestamptz'},
        safe: false,
      };
      return {expr: castExpr, malloyType, needsCast: true};
    }

    // Use character classes to avoid polynomial regex backtracking (CodeQL warning)
    const match = value.match(/^([^[]+)\[([^\]]+)\]$/);
    if (!match) {
      throw new Error(
        `Invalid timestamptz format: ${value}. Expected format: 'YYYY-MM-DD HH:MM:SS [Timezone]'`
      );
    }
    const [, tsPart, timezone] = match;

    return {
      expr: {
        node: 'timestamptzLiteral',
        literal: tsPart.trim(),
        typeDef: {type: 'timestamptz'},
        timezone,
      },
      malloyType,
      needsCast: false,
    };
  },
};
