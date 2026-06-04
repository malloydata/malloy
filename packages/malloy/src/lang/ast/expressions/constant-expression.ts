/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AccessModifierLabel, StructDef} from '../../../model/malloy_types';
import type {BinaryMalloyOperator} from '../types/binary_operators';

import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace, QueryFieldSpace} from '../types/field-space';
import type {LookupResult} from '../types/lookup-result';
import type {SpaceEntry} from '../types/space-entry';

export class ConstantFieldSpace implements FieldSpace {
  readonly type = 'fieldSpace';
  structDef(): StructDef {
    throw new Error('ConstantFieldSpace cannot generate a structDef');
  }
  emptyStructDef(): StructDef {
    throw new Error('ConstantFieldSpace cannot generate a structDef');
  }
  lookup(_name: unknown): LookupResult {
    return {
      error: {
        message: 'Only constants allowed in parameter default values',
        code: 'illegal-reference-in-parameter-default',
      },
      found: undefined,
    };
  }
  entries(): [string, SpaceEntry][] {
    return [];
  }
  entry(): undefined {
    return undefined;
  }
  dialectName() {
    return '~constant-space-unknown-dialect~';
  }
  dialectObj(): undefined {
    return undefined;
  }

  connectionName(): string {
    return '~constant-space-unknown-connection~';
  }

  isQueryFieldSpace(): this is QueryFieldSpace {
    return false;
  }

  accessProtectionLevel(): AccessModifierLabel {
    return 'private';
  }
}

export class ConstantExpression extends ExpressionDef {
  elementType = 'constantExpression';
  private cfs?: ConstantFieldSpace;
  constructor(readonly expr: ExpressionDef) {
    super({expr: expr});
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.constantValue();
  }

  private get constantFs(): FieldSpace {
    if (!this.cfs) {
      this.cfs = new ConstantFieldSpace();
    }
    return this.cfs;
  }

  constantValue(): ExprValue {
    return this.expr.getExpression(this.constantFs);
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef
  ): ExprValue {
    return this.expr.apply(fs, op, expr);
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }
}
