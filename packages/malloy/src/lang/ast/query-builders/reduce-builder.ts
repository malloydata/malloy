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

import type {
  CompositeFieldUsage,
  FilterCondition,
  PartialSegment,
  PipeSegment,
  QueryFieldDef,
  QuerySegment,
  ReduceSegment,
} from '../../../model/malloy_types';
import {
  canOrderBy,
  expressionIsAggregate,
  expressionIsAnalytic,
  hasExpression,
  isPartialSegment,
  isQuerySegment,
  isReduceSegment,
  isTemporalType,
} from '../../../model/malloy_types';

import {ErrorFactory} from '../error-factory';
import type {SourceFieldSpace} from '../types/field-space';
import {FieldName} from '../types/field-space';
import {Limit} from '../query-properties/limit';
import {Ordering} from '../query-properties/ordering';
import type {QueryProperty} from '../types/query-property';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import {ReduceFieldSpace} from '../field-space/query-spaces';
import {DefinitionList} from '../types/definition-list';
import type {QueryInputSpace} from '../field-space/query-input-space';
import type {MalloyElement} from '../types/malloy-element';
import {
  emptyCompositeFieldUsage,
  mergeCompositeFieldUsage,
} from '../../../model/composite_source_utils';

function queryFieldName(qf: QueryFieldDef): string {
  if (qf.type === 'fieldref') {
    return qf.path[qf.path.length - 1];
  }
  return qf.name;
}

export abstract class QuerySegmentBuilder implements QueryBuilder {
  order?: Ordering;
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
    return this.resultFS.compositeFieldUsage;
  }

  refineFrom(from: PipeSegment | undefined, to: QuerySegment): void {
    if (from && from.type !== 'index' && from.type !== 'raw') {
      if (!this.limit && from.orderBy && !from.defaultOrderBy) {
        to.orderBy = from.orderBy;
      }
      if (!this.limit && from.limit) {
        to.limit = from.limit;
      }
    }

    if (this.order) {
      to.orderBy = this.order.getOrderBy(this.inputFS);
      delete to.defaultOrderBy;
    }

    if (this.limit) {
      to.limit = this.limit;
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

    if (reduceSegment.orderBy) {
      // In the modern world, we will ONLY allow names and not numbers in order by lists
      for (const by of reduceSegment.orderBy) {
        if (typeof by.field === 'number') {
          const by_field = reduceSegment.queryFields[by.field - 1];
          by.field = queryFieldName(by_field);
        }
      }
    }
    if (reduceSegment.orderBy === undefined || reduceSegment.defaultOrderBy) {
      // In the modern world, we will order all reduce segments with the default ordering
      let usableDefaultOrderField: string | undefined;
      for (const field of reduceSegment.queryFields) {
        let fieldAggregate = false;
        let fieldAnalytic = false;
        let fieldType: string;
        const fieldName = queryFieldName(field);
        if (field.type === 'fieldref') {
          const lookupPath = field.path.map(el => new FieldName(el));
          const refField = this.inputFS.lookup(lookupPath).found;
          if (refField) {
            const typeDesc = refField.typeDesc();
            fieldType = typeDesc.type;
            fieldAggregate = expressionIsAggregate(typeDesc.expressionType);
            fieldAnalytic = expressionIsAnalytic(typeDesc.expressionType);
          } else {
            continue;
          }
        } else {
          fieldType = field.type;
          fieldAggregate =
            hasExpression(field) && expressionIsAggregate(field.expressionType);
          fieldAnalytic =
            hasExpression(field) && expressionIsAnalytic(field.expressionType);
        }
        if (isTemporalType(fieldType) || fieldAggregate) {
          reduceSegment.defaultOrderBy = true;
          reduceSegment.orderBy = [{field: fieldName, dir: 'desc'}];
          usableDefaultOrderField = undefined;
          break;
        }
        if (
          canOrderBy(fieldType) &&
          !fieldAnalytic &&
          !usableDefaultOrderField
        ) {
          usableDefaultOrderField = fieldName;
        }
      }
      if (usableDefaultOrderField) {
        reduceSegment.defaultOrderBy = true;
        reduceSegment.orderBy = [{field: usableDefaultOrderField, dir: 'asc'}];
      }
    }
    return reduceSegment;
  }
}
