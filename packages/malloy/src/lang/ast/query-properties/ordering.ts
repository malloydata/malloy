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

import {OrderBy as ModelOrderBy} from '../../../model/malloy_types';

import {FieldName, FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';

export class OrderBy extends MalloyElement {
  elementType = 'orderBy';
  constructor(
    readonly field: number | FieldName,
    readonly dir?: 'asc' | 'desc'
  ) {
    super();
    if (field instanceof FieldName) {
      this.has({field: field});
    }
  }

  get modelField(): string | number {
    return typeof this.field === 'number' ? this.field : this.field.refString;
  }

  getOrderBy(fs: FieldSpace): ModelOrderBy {
    // TODO jump-to-definition now that we can lookup fields in the output space,
    // we need to actually add the reference when we do so.
    if (this.field instanceof FieldName && fs.isQueryFieldSpace()) {
      const output = fs.outputSpace();
      const entry = this.field.getField(output);
      if (entry.error) {
        this.field.log(entry.error);
      }
      if (entry.found?.typeDesc().evalSpace === 'input') {
        this.log(`Unknown field ${this.field.refString} in output space`);
      }
      if (entry.found?.typeDesc().expressionType === 'analytic') {
        this.log(`Illegal order by of analytic field ${this.field.refString}`);
      }
    }
    const orderElement: ModelOrderBy = {field: this.modelField};
    if (this.dir) {
      orderElement.dir = this.dir;
    }
    return orderElement;
  }
}

export class Ordering extends ListOf<OrderBy> {
  constructor(list: OrderBy[]) {
    super('ordering', list);
  }

  getOrderBy(fs: FieldSpace): ModelOrderBy[] {
    return this.list.map(el => el.getOrderBy(fs));
  }
}
