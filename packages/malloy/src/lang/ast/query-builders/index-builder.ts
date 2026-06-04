/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  FieldUsage,
  FilterCondition,
  PipeSegment,
  Sampling,
} from '../../../model/malloy_types';
import {
  fieldUsageFrom,
  isIndexSegment,
  isPartialSegment,
  setFieldUsage,
} from '../../../model/malloy_types';

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
import {emptyFieldUsage, mergeFieldUsage} from '../../composite-source-utils';

export class IndexBuilder implements QueryBuilder {
  filters: FilterCondition[] = [];
  limit?: Limit;
  indexOn?: FieldName;
  sample?: Sampling;
  resultFS: IndexFieldSpace;
  inputFS: QueryInputSpace;
  alwaysJoins: string[] = [];
  requiredGroupBys: string[] = [];
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

  get fieldUsage(): FieldUsage {
    return this.resultFS.fieldUsage;
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

    const fromFieldUsage =
      from && from.type === 'index'
        ? fieldUsageFrom(from.refSummary)
        : emptyFieldUsage();
    const fieldUsage = mergeFieldUsage(fromFieldUsage, this.fieldUsage) ?? [];

    // Index queries always compute an aggregate for weight (at minimum COUNT(*)).
    // The compiler needs a uniqueKeyRequirement on the base path so that
    // symmetric aggregation is enabled when joins are present.
    fieldUsage.push({
      path: [],
      uniqueKeyRequirement: {isCount: true},
    });
    setFieldUsage(indexSegment, fieldUsage);

    return indexSegment;
  }
}
