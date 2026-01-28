/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Expr,
  Parameter,
  TurtleDef,
  QuerySegment,
  PrepareResultOptions,
  SourceDef,
} from './malloy_types';
import type {Dialect, QueryInfo} from '../dialect';
import {exprToSQL} from './expression_compiler';
import {AndChain} from './utils';
import {QueryStruct, type ModelRootInterface} from './query_node';
import type {EventStream} from '../runtime_types';
import {FieldInstanceResultRoot} from './field_instance';
import type {JoinInstance} from './join_instance';

/**
 * Custom error class for constant expression compilation errors.
 * Used to distinguish expected errors from unexpected ones.
 */
class ConstantExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstantExpressionError';
  }
}

/**
 * Minimal FieldInstanceResultRoot for constant expressions.
 * This serves as both the result set and its own root, providing
 * only what's needed by exprToSQL for constants.
 */
class ConstantFieldInstanceResultRoot extends FieldInstanceResultRoot {
  override joins = new Map<string, JoinInstance>();
  override havings = new AndChain();
  override isComplexQuery = false;
  override queryUsesPartitioning = false;
  override computeOnlyGroups: number[] = [];
  override elimatedComputeGroups = false;

  constructor() {
    // Create a minimal TurtleDef
    const minimalTurtleDef: TurtleDef = {
      type: 'turtle',
      name: '__constant__',
      pipeline: [],
    };
    super(minimalTurtleDef);

    // Create minimal SourceDef for outputStruct
    const minimalOutputStruct: SourceDef = {
      type: 'table',
      name: '__constant_output__',
      fields: [],
      tablePath: '__constant__',
      connection: '__constant__',
      dialect: 'standardsql',
    };

    // Create minimal QuerySegment
    const minimalSegment: QuerySegment = {
      type: 'project',
      filterList: [],
      queryFields: [],
      outputStruct: minimalOutputStruct,
      isRepeated: false,
    };

    this.firstSegment = minimalSegment;
  }

  override root(): FieldInstanceResultRoot {
    return this;
  }

  override getQueryInfo(): QueryInfo {
    // Return minimal query info - constants don't need timezone
    return {
      queryTimezone: 'UTC',
    };
  }
}

/**
 * Minimal QueryStruct subclass for constant expression compilation.
 * This provides only what's needed to compile expressions containing
 * literals and parameters, without requiring a full query structure.
 */
class ConstantQueryStruct extends QueryStruct {
  private _constantArguments: Record<string, Parameter>;
  override dialect: Dialect;

  constructor(
    dialect: Dialect,
    parameters: Record<string, Parameter>,
    eventStream?: EventStream
  ) {
    // Create a minimal StructDef that satisfies the constructor requirements
    const minimalStructDef: SourceDef = {
      type: 'table',
      name: '__constant__',
      fields: [],
      tablePath: '__constant__',
      connection: dialect.name,
      dialect: dialect.name,
    };

    // Create minimal model with empty structs map
    const minimalModel: ModelRootInterface = {
      structs: new Map(),
    };

    // Create minimal prepare result options with eventStream
    const minimalPrepareOptions: PrepareResultOptions = {eventStream};

    // Call parent constructor with minimal requirements
    super(
      minimalStructDef,
      undefined, // no source arguments initially
      {model: minimalModel},
      minimalPrepareOptions
    );

    this.dialect = dialect;
    this._constantArguments = parameters;
  }

  /**
   * Override arguments() to return our parameters
   */
  override arguments(): Record<string, Parameter> {
    return this._constantArguments;
  }

  /**
   * These methods should not be called for constant expressions
   */
  override getFieldByName(path: string[]): never {
    throw new ConstantExpressionError(
      `Illegal reference to '${path.join('.')}' in constant expressions`
    );
  }

  override getStructByName(path: string[]): never {
    throw new ConstantExpressionError(
      `Illegal reference to '${path.join('.')}' in constant expressions`
    );
  }

  override getSQLIdentifier(): never {
    throw new ConstantExpressionError(
      'Constant expressions do not need SQL identifiers'
    );
  }
}

type ConstantExpressionResult =
  | {sql: string; error?: undefined}
  | {sql?: undefined; error: string};

/**
 * Compiles an IR expression containing only constants and parameters to SQL.
 * This is useful for expressions that don't reference source fields.
 *
 * @param expr The expression to compile (should contain only literals, parameters, and operations on them)
 * @param dialect The SQL dialect to use for generation
 * @param parameters Parameters that can be referenced in the expression
 * @param eventStream Optional event stream for debugging/tracking
 * @returns Either {sql: string} on success or {error: string} on failure
 */
export function constantExprToSQL(
  expr: Expr,
  dialect: Dialect,
  parameters: Record<string, Parameter> = {},
  eventStream?: EventStream
): ConstantExpressionResult {
  try {
    const context = new ConstantQueryStruct(dialect, parameters, eventStream);
    const resultSet = new ConstantFieldInstanceResultRoot();
    const sql = exprToSQL(resultSet, context, expr);
    return {sql};
  } catch (error) {
    if (error instanceof ConstantExpressionError) {
      return {error: error.message};
    }
    // Re-throw unexpected errors
    throw error;
  }
}
