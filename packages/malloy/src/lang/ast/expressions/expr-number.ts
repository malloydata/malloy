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

export class ExprNumber extends ExpressionDef {
  elementType = 'numeric literal';
  constructor(readonly n: string) {
    super();
  }

  getExpression(fs: FieldSpace): ExprValue {
    const dialect = fs.dialectObj();
    const dataType = dialect?.literalNumberType(this.n) ?? this.defaultNumberType();

    return literalExprValue({
      dataType,
      value: {node: 'numberLiteral', literal: this.n},
    });
  }

  /**
   * Default number type when no dialect is available.
   * Integers default to bigint for safety, floats to float.
   */
  private defaultNumberType(): NumberTypeDef {
    const isInteger = /^-?\d+$/.test(this.n);
    return isInteger
      ? {type: 'number', numberType: 'bigint'}
      : {type: 'number', numberType: 'float'};
  }

  /**
   * For constants (no dialect context), always use bigint for integers
   * to ensure large values render correctly.
   */
  constantExpression(): ExprValue {
    return literalExprValue({
      dataType: this.defaultNumberType(),
      value: {node: 'numberLiteral', literal: this.n},
    });
  }

  getStableLiteral(): Malloy.LiteralValue {
    return {
      kind: 'number_literal',
      number_value: Number(this.n),
    };
  }
}
