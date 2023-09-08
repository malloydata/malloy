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

import {FieldReference} from '../query-items/field-references';
import {ExpressionDef} from '../types/expression-def';
import {ExprAggregateFunction} from './expr-aggregate-function';

export abstract class ExprAsymmetric extends ExprAggregateFunction {
  constructor(
    readonly func: 'sum' | 'avg',
    readonly expr: ExpressionDef | undefined,
    readonly source?: FieldReference,
    explicitSource?: boolean
  ) {
    super(func, expr, explicitSource);
    this.has({source: source});
  }

  isSymmetricFunction() {
    return false;
  }

  defaultFieldName(): undefined | string {
    if (this.source && this.expr === undefined) {
      const tag = this.source.nameString;
      switch (this.func) {
        case 'sum':
          return `total_${tag}`;
        case 'avg':
          return `avg_${tag}`;
      }
    }
    return undefined;
  }
}
