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
  PipeSegment,
  Sampling,
} from '../../../model/malloy_types';
import {isIndexSegment, isPartialSegment} from '../../../model/malloy_types';

import {ErrorFactory} from '../error-factory';
import type {FieldName, SourceFieldSpace} from '../types/field-space';
import {Filter} from '../query-properties/filters';
import {Index} from '../query-properties/indexing';
import {Limit} from '../query-properties/limit';
import {SampleProperty} from '../query-properties/sampling';
import {IndexFieldSpace} from '../field-space/index-field-space';
import type {QueryProperty} from '../types/query-property';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryInputSpace} from '../field-space/query-input-space';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {MalloyElement} from '../types/malloy-element';
import {
  emptyCompositeFieldUsage,
  mergeCompositeFieldUsage,
} from '../../../model/composite_source_utils';

export class IndexBuilder implements QueryBuilder {
  filters: FilterCondition[] = [];
  limit?: Limit;
  indexOn?: FieldName;
  sample?: Sampling;
  resultFS: IndexFieldSpace;
  inputFS: QueryInputSpace;
  alwaysJoins: string[] = [];
  readonly type = 'index';

  constructor(
    inputFS: SourceFieldSpace,
    refineThis: PipeSegment | undefined,
    isNestIn: QueryOperationSpace | undefined,
    astEl: MalloyElement
  ) {
    this.resultFS = new IndexFieldSpace(inputFS, refineThis, isNestIn, astEl);
    this.inputFS = this.resultFS.inputSpace();
  }

  execute(qp: QueryProperty): void {
    if (qp instanceof Filter) {
      qp.queryExecute(this);
    } else if (qp instanceof Limit) {
      if (this.limit) {
        this.limit.logError(
          'index-limit-already-specified',
          'Ignored, too many limit: statements'
        );
      }
      this.limit = qp;
    } else if (qp instanceof Index) {
      this.resultFS.pushFields(...qp.fields.list);
      if (qp.weightBy) {
        if (this.indexOn) {
          this.indexOn.logError(
            'index-by-already-specified',
            'Ignoring previous BY'
          );
        }
        this.indexOn = qp.weightBy;
      }
    } else if (qp instanceof SampleProperty) {
      this.sample = qp.sampling();
    } else {
      qp.logError(
        'illegal-operation-for-index',
        'Not legal in an index query operation'
      );
    }
  }

  get compositeFieldUsage(): CompositeFieldUsage {
    return this.resultFS.compositeFieldUsage;
  }

  finalize(from: PipeSegment | undefined): PipeSegment {
    if (from && !isIndexSegment(from) && !isPartialSegment(from)) {
      this.resultFS.logError(
        'refinement-of-index-segment',
        `Can't refine index with ${from.type}`
      );
      return ErrorFactory.indexSegment;
    }

    const indexSegment = this.resultFS.getPipeSegment(from);

    const oldFilters = from?.filterList || [];
    if (this.filters.length > 0 && !oldFilters) {
      indexSegment.filterList = this.filters;
    } else if (oldFilters) {
      indexSegment.filterList = [...oldFilters, ...this.filters];
    }

    if (from?.limit) {
      indexSegment.limit = from.limit;
    }
    if (this.limit) {
      indexSegment.limit = this.limit.limit;
    }

    if (this.indexOn) {
      indexSegment.weightMeasure = this.indexOn.refString;
    }

    if (from && isIndexSegment(from) && from?.sample) {
      indexSegment.sample = from.sample;
    }
    if (this.sample) {
      indexSegment.sample = this.sample;
    }

    if (this.alwaysJoins.length > 0) {
      indexSegment.alwaysJoins = [...this.alwaysJoins];
    }

    const fromCompositeFieldUsage =
      from && from.type === 'index'
        ? from.compositeFieldUsage ?? emptyCompositeFieldUsage()
        : emptyCompositeFieldUsage();
    indexSegment.compositeFieldUsage = mergeCompositeFieldUsage(
      fromCompositeFieldUsage,
      this.compositeFieldUsage
    );

    return indexSegment;
  }
}
