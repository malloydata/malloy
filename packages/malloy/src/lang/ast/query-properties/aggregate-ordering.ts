/*
 * Copyright 2024 Google LLC
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

import {
  expressionIsScalar,
  AggregateOrderBy as ModelAggregateOrderBy,
} from '../../../model/malloy_types';
import {ExpressionDef} from '../types/expression-def';

import {FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';

export class AggregateOrderBy extends MalloyElement {
  elementType = 'orderBy';
  constructor(
    readonly field: ExpressionDef,
    readonly dir?: 'asc' | 'desc'
  ) {
    super();
    this.has({field});
  }

  getAggregateOrderBy(fs: FieldSpace): ModelAggregateOrderBy {
    const expr = this.field.getExpression(fs);
    if (!expressionIsScalar(expr.expressionType)) {
      this.log('aggregate order_by must be scalar');
    }
    return {e: expr.value, dir: this.dir};
  }
}

export class AggregateOrdering extends ListOf<AggregateOrderBy> {
  elementType = 'aggregate-ordering';

  constructor(list: AggregateOrderBy[]) {
    super(list);
  }

  getAggregateOrderBy(fs: FieldSpace): ModelAggregateOrderBy[] {
    return this.list.map(el => el.getAggregateOrderBy(fs));
  }
}
