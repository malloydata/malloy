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

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {ExpressionDef} from '../types/expression-def';
import type {NumberTypeDef} from '../../../model';
import {Dialect, type IntegerTypeLimits} from '../../../dialect/dialect';

export class ExprNumber extends ExpressionDef {
  elementType = 'numeric literal';
  constructor(readonly n: string) {
    super();
  }

  getExpression(fs: FieldSpace): ExprValue {
    // Check if this is an integer (no decimal point, no exponent notation)
    const isInteger = /^-?\d+$/.test(this.n);

    if (!isInteger) {
      return literalExprValue({
        dataType: {type: 'number', numberType: 'float'},
        value: {node: 'numberLiteral', literal: this.n},
      });
    }

    const dialect = fs.dialectObj();
    const limits = dialect?.integerTypeLimits ?? {
      integer: {min: '-2^53-1', max: '2^53-1'},
      bigint: null,
    };

    const literalValue = BigInt(this.n);
    const numberType = this.selectIntegerType(literalValue, limits);

    if (numberType === null) {
      // Find the largest supported range for the error message
      const maxRange = this.getMaxRange(limits);
      this.logError(
        'integer-literal-out-of-range',
        `Integer literal ${this.n} exceeds ${dialect?.name ?? 'dialect'} integer range [${maxRange.min} to ${maxRange.max}]`
      );
      // Fall back to bigint so we can continue compilation
      return literalExprValue({
        dataType: {type: 'number', numberType: 'bigint'},
        value: {node: 'numberLiteral', literal: this.n},
      });
    }

    return literalExprValue({
      dataType: {type: 'number', numberType},
      value: {node: 'numberLiteral', literal: this.n},
    });
  }

  /**
   * For constants (no dialect context), always use bigint for integers
   * to ensure large values render correctly.
   */
  constantExpression(): ExprValue {
    const isInteger = /^-?\d+$/.test(this.n);
    const dataType: NumberTypeDef = isInteger
      ? {type: 'number', numberType: 'bigint'}
      : {type: 'number', numberType: 'float'};

    return literalExprValue({
      dataType,
      value: {node: 'numberLiteral', literal: this.n},
    });
  }

  /**
   * Select the appropriate integer type based on dialect limits.
   * Returns null if no type can hold the value.
   */
  private selectIntegerType(
    value: bigint,
    limits: IntegerTypeLimits
  ): 'integer' | 'bigint' | null {
    const types: (keyof IntegerTypeLimits)[] = ['integer', 'bigint'];

    for (const numType of types) {
      const range = limits[numType];
      if (range !== null) {
        const min = Dialect.parseIntegerLimit(range.min);
        const max = Dialect.parseIntegerLimit(range.max);
        if (value >= min && value <= max) {
          return numType;
        }
      }
    }

    return null;
  }

  /**
   * Get the largest supported range for error messages.
   */
  private getMaxRange(limits: IntegerTypeLimits): {min: string; max: string} {
    // Check in reverse order to find the largest supported type
    const types: (keyof IntegerTypeLimits)[] = ['bigint', 'integer'];
    for (const numType of types) {
      const range = limits[numType];
      if (range !== null) {
        return range;
      }
    }
    // Should never happen, but fallback
    return {min: '0', max: '0'};
  }

  getStableLiteral(): Malloy.LiteralValue {
    return {
      kind: 'number_literal',
      number_value: Number(this.n),
    };
  }
}
