/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {BasicAtomicTypeDef} from '../../model/malloy_types';
import type {DialectFunctionOverloadDef} from '../functions';
import {expandBlueprintMap, expandOverrideMap} from '../functions';
import {TrinoDialect} from '../trino/trino';
import {ATHENA_DIALECT_FUNCTIONS} from './dialect_functions';
import {ATHENA_MALLOY_STANDARD_OVERLOADS} from './function_overrides';

/**
 * Athena engine version 3 is Trino behind the AWS API, and that API returns
 * every value as text: a compound value in Presto's `{a=1, b=x}` form,
 * which nothing reads back. So the dialect is Trino's for scalar queries
 * and declares nests, records and arrays unsupported.
 */
export class AthenaDialect extends TrinoDialect {
  name = 'athena';
  experimental = true;
  // The parser rejects QUALIFY at submission.
  supportsQualify = false;
  // The later stages of a pipelined nest run as a correlated subquery,
  // which Athena rejects ("Given correlated subquery is not supported").
  supportsPipelinesInViews = false;
  // A compound value arrives as Presto text, which nothing reads back.
  supportsNesting = false;
  readsNestedData = false;
  supportsArraysInData = false;
  compoundObjectInSchema = false;
  // bigint arrives as exact digits and is read into a JS number.
  supportsBigIntPrecision = false;

  getDialectFunctionOverrides(): {
    [name: string]: DialectFunctionOverloadDef[];
  } {
    return expandOverrideMap(ATHENA_MALLOY_STANDARD_OVERLOADS);
  }

  getDialectFunctions(): {[name: string]: DialectFunctionOverloadDef[]} {
    return expandBlueprintMap(ATHENA_DIALECT_FUNCTIONS);
  }

  sqlTypeToMalloyType(sqlType: string): BasicAtomicTypeDef {
    // information_schema and EXPLAIN spell the 32-bit float `real`.
    if (sqlType.toLowerCase() === 'real') {
      return {type: 'number', numberType: 'float'};
    }
    return super.sqlTypeToMalloyType(sqlType);
  }

  // Nests, arrays and records are not supported: supportsNesting,
  // supportsArraysInData and compoundObjectInSchema are false. A call here
  // comes from a literal, a source the translator let through, or an
  // ungrouped aggregate (all(), exclude()), which shares the nest machinery.
  sqlAggregateTurtle(): string {
    return this.unsupported('nesting');
  }

  sqlAnyValueTurtle(): string {
    return this.unsupported('nesting');
  }

  sqlAnyValueLastTurtle(): string {
    return this.unsupported('nesting');
  }

  sqlCoaleseMeasuresInline(): string {
    return this.unsupported('nesting');
  }

  sqlCreateFunctionCombineLastStage(): string {
    return this.unsupported('nesting');
  }

  sqlUnnestPipelineHead(): string {
    return this.unsupported('nesting');
  }

  sqlUnnestAlias(): string {
    return this.unsupported('arrays');
  }

  sqlLiteralRecord(): string {
    return this.unsupported('record literals');
  }

  sqlLiteralArray(): string {
    return this.unsupported('array literals');
  }

  private unsupported(what: string): never {
    throw new Error(
      `Athena dialect does not support ${what}: a compound value arrives from the API as text`
    );
  }
}
