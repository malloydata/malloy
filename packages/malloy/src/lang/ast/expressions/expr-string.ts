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

import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';

export class ExprString extends ExpressionDef {
  elementType = 'string literal';
  value: string;
  constructor(src: string) {
    super();
    this.value = src;
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return literalExprValue({
      dataType: {type: 'string'},
      value: {node: 'stringLiteral', literal: this.value},
    });
  }

  getStableLiteral(): Malloy.LiteralValue {
    return {
      kind: 'string_literal',
      string_value: this.value,
    };
  }
}
