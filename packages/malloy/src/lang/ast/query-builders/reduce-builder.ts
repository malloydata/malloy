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

import {
  CompositeFieldUsage,
  FilterCondition,
  PartialSegment,
  PipeSegment,
  QuerySegment,
  ReduceSegment,
  isPartialSegment,
  isQuerySegment,
  isReduceSegment,
} from '../../../model/malloy_types';

import {ErrorFactory} from '../error-factory';
import {SourceFieldSpace} from '../types/field-space';
import {Limit} from '../query-properties/limit';
import {Ordering} from '../query-properties/ordering';
import {Top} from '../query-properties/top';
import {QueryProperty} from '../types/query-property';
import {QueryBuilder} from '../types/query-builder';
import {
  QueryOperationSpace,
  ReduceFieldSpace,
} from '../field-space/query-spaces';
import {DefinitionList} from '../types/definition-list';
import {QueryInputSpace} from '../field-space/query-input-space';
import {MalloyElement} from '../types/malloy-element';
import {
  emptyCompositeFieldUsage,
  mergeCompositeFieldUsage,
} from '../../../model/composite_source_utils';

export abstract class QuerySegmentBuilder implements QueryBuilder {
  order?: Top | Ordering;
  limit?: number;
  alwaysJoins: string[] = [];
  abstract inputFS: QueryInputSpace;
  abstract resultFS: QueryOperationSpace;
  abstract readonly type: 'grouping' | 'project';
  filters: FilterCondition[] = [];

  execute(qp: QueryProperty): void {
    if (qp.queryExecute) {
      qp.queryExecute(this);
      return;
    }
    if (qp instanceof DefinitionList) {
      this.resultFS.pushFields(...qp.list);
    } else if (qp instanceof Top) {
      if (this.limit) {
        qp.logError(
          'limit-already-specified',
          'Query operation already limited'
        );
      } else {
        this.limit = qp.limit;
      }
      if (qp.by) {
        if (this.order) {
          qp.logError(
            'ordering-already-specified',
            'Query operation is already sorted'
          );
        } else {
          this.order = qp;
        }
      }
    } else if (qp instanceof Limit) {
      if (this.limit) {
        qp.logError(
          'limit-already-specified',
          'Query operation already limited'
        );
      } else {
        this.limit = qp.limit;
      }
    } else if (qp instanceof Ordering) {
      if (this.order) {
        qp.logError(
          'ordering-already-specified',
          'Query operation already sorted'
        );
      } else {
        this.order = qp;
      }
    }
  }

  abstract finalize(fromSeg: PipeSegment | undefined): PipeSegment;

  get compositeFieldUsage(): CompositeFieldUsage {
    return mergeCompositeFieldUsage(
      this.resultFS.compositeFieldUsage,
      ...this.filters.map(
        f => f.compositeFieldUsage ?? emptyCompositeFieldUsage()
      )
    );
  }

  refineFrom(from: PipeSegment | undefined, to: QuerySegment): void {
    if (from && from.type !== 'index' && from.type !== 'raw') {
      if (!this.order) {
        if (from.orderBy) {
          to.orderBy = from.orderBy;
        } else if (from.by) {
          to.by = from.by;
        }
      }
      if (!this.limit && from.limit) {
        to.limit = from.limit;
      }
    }

    if (this.limit) {
      to.limit = this.limit;
    }

    if (this.order instanceof Top) {
      const topBy = this.order.getBy(this.inputFS);
      if (topBy) {
        to.by = topBy;
      }
    }
    if (this.order instanceof Ordering) {
      to.orderBy = this.order.getOrderBy(this.inputFS);
    }

    const oldFilters = from?.filterList || [];
    if (this.filters.length > 0 && !oldFilters) {
      to.filterList = this.filters;
    } else if (oldFilters) {
      to.filterList = [...oldFilters, ...this.filters];
    }

    if (this.alwaysJoins.length > 0) {
      to.alwaysJoins = [...this.alwaysJoins];
    }

    const fromCompositeFieldUsage =
      from && isQuerySegment(from)
        ? from.compositeFieldUsage ?? emptyCompositeFieldUsage()
        : emptyCompositeFieldUsage();
    to.compositeFieldUsage = mergeCompositeFieldUsage(
      fromCompositeFieldUsage,
      this.compositeFieldUsage
    );
  }
}

export class ReduceBuilder extends QuerySegmentBuilder implements QueryBuilder {
  inputFS: QueryInputSpace;
  resultFS: ReduceFieldSpace;
  readonly type = 'grouping';

  constructor(
    baseFS: SourceFieldSpace,
    refineThis: PipeSegment | undefined,
    isNestIn: QueryOperationSpace | undefined,
    astEl: MalloyElement
  ) {
    super();
    this.resultFS = new ReduceFieldSpace(baseFS, refineThis, isNestIn, astEl);
    this.inputFS = this.resultFS.inputSpace();
  }

  finalize(fromSeg: PipeSegment | undefined): PipeSegment {
    let from: ReduceSegment | PartialSegment | undefined;
    if (fromSeg) {
      if (isReduceSegment(fromSeg) || isPartialSegment(fromSeg)) {
        from = fromSeg;
      } else {
        this.resultFS.logError(
          'incompatible-segment-for-reduce-refinement',
          `Can't refine reduce with ${fromSeg.type}`
        );
        return ErrorFactory.reduceSegment;
      }
    }
    const reduceSegment = this.resultFS.getQuerySegment(from);
    this.refineFrom(from, reduceSegment);

    return reduceSegment;
  }
}
