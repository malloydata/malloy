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

import {StructDef} from '../../../model/malloy_types';
import {BinaryMalloyOperator} from '../types/binary_operators';

import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace, QueryFieldSpace} from '../types/field-space';
import {LookupResult} from '../types/lookup-result';
import {SpaceEntry} from '../types/space-entry';

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
  dialectObj(): undefined {
    return undefined;
  }
  isQueryFieldSpace(): this is QueryFieldSpace {
    return false;
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
