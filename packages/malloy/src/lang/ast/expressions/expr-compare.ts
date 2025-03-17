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

import * as TDU from '../typedesc-utils';
import type {
  BinaryMalloyOperator,
  CompareMalloyOperator,
  EqualityMalloyOperator,
} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {BinaryBoolean} from './binary-boolean';

const compareTypes = {
  '~': [TDU.stringT],
  '!~': [TDU.stringT],
  '<': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '<=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '!=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '>=': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
  '>': [TDU.numberT, TDU.stringT, TDU.dateT, TDU.timestampT],
};

export class ExprCompare extends BinaryBoolean<CompareMalloyOperator> {
  elementType = 'a<=>b';
  constructor(
    left: ExpressionDef,
    op: CompareMalloyOperator,
    right: ExpressionDef
  ) {
    super(left, op, right);
    this.legalChildTypes = compareTypes[op];
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.right.apply(fs, this.op, this.left);
  }
}

/**
 * The parser makes equality nodes, an application of ?
 * makes an ExprCompare node with operator =. This is how
 * the special rules for how apply works for equality
 * nodes gets implemented.
 */
export class ExprEquality extends ExprCompare {
  elementType = 'a~=b';
  constructor(
    left: ExpressionDef,
    op: EqualityMalloyOperator,
    right: ExpressionDef
  ) {
    super(left, op, right);
  }

  getExpression(fs: FieldSpace): ExprValue {
    return this.right.apply(fs, this.op, this.left, true);
  }

  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    left: ExpressionDef
  ): ExprValue {
    return super.apply(fs, op, left, true);
  }
}

export class ExprLegacyIn extends ExpressionDef {
  elementType = 'in';
  constructor(
    readonly expr: ExpressionDef,
    readonly notIn: boolean,
    readonly choices: ExpressionDef[]
  ) {
    super();
    this.has({expr, choices});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const lookFor = this.expr.getExpression(fs);
    const oneOf = this.choices.map(e => e.getExpression(fs));
    return computedExprValue({
      dataType: {type: 'boolean'},
      value: {
        node: 'in',
        not: this.notIn,
        kids: {e: lookFor.value, oneOf: oneOf.map(v => v.value)},
      },
      from: [lookFor, ...oneOf],
    });
  }
}
