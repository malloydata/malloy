/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AccessModifierLabel, StructDef} from '../../../model/malloy_types';
import type {BinaryMalloyOperator} from '../types/binary_operators';

import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace, QueryFieldSpace} from '../types/field-space';
import {currentGeneration} from '../types/field-space';
import type {Forms} from '../types/forms';
import {valueAs} from '../types/forms';
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

  // Binds nothing at all -- every lookup is an error.
  generation(): number {
    return currentGeneration();
  }
}

export class ConstantExpression extends ExpressionDef {
  elementType = 'constantExpression';
  private cfs?: ConstantFieldSpace;
  constructor(readonly expr: ExpressionDef) {
    super({expr: expr});
  }

  protected computeExpression(_fs: FieldSpace): ExprValue {
    return this.constantValue();
  }

  protected computeForms(_fs: FieldSpace): Forms {
    return this.constantForms();
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

  constantForms(): Forms {
    return this.expr.getForms(this.constantFs);
  }

  /** The value as the declared `type`, when it can be read as one */
  constantValueAs(type: string | undefined): ExprValue {
    return valueAs(this.constantForms(), type);
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef,
    byApplyOperator = false
  ): ExprValue {
    return this.expr.apply(fs, op, expr, byApplyOperator);
  }

  applyForms(fs: FieldSpace, left: ExpressionDef): Forms {
    return this.expr.applyForms(fs, left);
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    return this.expr.requestExpression(fs);
  }
}
