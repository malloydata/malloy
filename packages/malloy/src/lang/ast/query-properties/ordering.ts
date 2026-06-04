/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {OrderBy as ModelOrderBy} from '../../../model/malloy_types';
import {expressionIsAnalytic} from '../../../model/malloy_types';

import type {FieldSpace} from '../types/field-space';
import {FieldName} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

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
        this.field.logError(entry.error.code, entry.error.message);
      }
      if (!entry.found || !entry.isOutputField) {
        this.logError(
          'order-by-not-found-in-output',
          `Unknown field ${this.field.refString} in output space`
        );
      }
      if (expressionIsAnalytic(entry.found?.typeDesc().expressionType)) {
        this.logError(
          'order-by-analytic',
          `Illegal order by of analytic field ${this.field.refString}`
        );
      }
    }
    const orderElement: ModelOrderBy = {field: this.modelField};
    if (this.dir) {
      orderElement.dir = this.dir;
    }
    return orderElement;
  }
}

export class Ordering
  extends ListOf<OrderBy>
  implements QueryPropertyInterface
{
  elementType = 'ordering';
  queryRefinementStage = LegalRefinementStage.Tail;
  forceQueryClass = undefined;

  constructor(list: OrderBy[]) {
    super(list);
  }

  getOrderBy(fs: FieldSpace): ModelOrderBy[] {
    return this.list.map(el => el.getOrderBy(fs));
  }
}
