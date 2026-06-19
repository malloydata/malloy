/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PipeSegment} from '../../../model/malloy_types';
import type {QueryBuilder} from '../types/query-builder';
import {IndexBuilder} from '../query-builders/index-builder';
import {ProjectBuilder} from '../query-builders/project-builder';
import {ReduceBuilder} from '../query-builders/reduce-builder';
import type {SourceFieldSpace} from '../types/field-space';
import type {MalloyElement} from '../types/malloy-element';
import {ListOf} from '../types/malloy-element';
import type {OpDesc} from '../types/op-desc';
import type {QueryProperty} from '../types/query-property';
import {QueryClass} from '../types/query-property-interface';
import {PartialBuilder} from '../query-builders/partial-builder';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import {modernizeTermsForUserText} from '../../utils';

export class QOpDesc extends ListOf<QueryProperty> {
  elementType = 'queryOperation';
  opClass: QueryClass | undefined;
  private refineThis?: PipeSegment;

  protected computeType(): QueryClass | undefined {
    let guessType: QueryClass | undefined;
    let needsExplicitQueryClass = false;
    if (this.refineThis) {
      if (this.refineThis.type === 'reduce') {
        guessType = QueryClass.Grouping;
      } else if (this.refineThis.type === 'project') {
        guessType = QueryClass.Project;
      } else if (this.refineThis.type === 'index') {
        guessType = QueryClass.Index;
      }
    }
    for (const el of this.list) {
      if (el.forceQueryClass) {
        if (guessType) {
          if (guessType !== el.forceQueryClass) {
            el.logError(
              `illegal-${guessType}-operation`,
              `Use of ${modernizeTermsForUserText(
                el.forceQueryClass
              )} is not allowed in a ${modernizeTermsForUserText(
                guessType
              )} query`
            );
          }
        } else {
          guessType = el.forceQueryClass;
        }
      }
      needsExplicitQueryClass ||= el.needsExplicitQueryClass ?? false;
    }
    if (guessType === undefined && needsExplicitQueryClass) {
      this.logError('ambiguous-view-type', {});
      guessType = QueryClass.Project;
    }
    this.opClass = guessType;
    return guessType;
  }

  refineFrom(existing: PipeSegment): void {
    this.refineThis = existing;
  }

  private getBuilder(
    baseFS: SourceFieldSpace,
    isNestIn: QueryOperationSpace | undefined,
    astEl: MalloyElement
  ): QueryBuilder {
    switch (this.computeType()) {
      case QueryClass.Grouping:
        return new ReduceBuilder(baseFS, this.refineThis, isNestIn, astEl);
      case QueryClass.Project:
        return new ProjectBuilder(baseFS, this.refineThis, isNestIn, astEl);
      case QueryClass.Index:
        return new IndexBuilder(baseFS, this.refineThis, isNestIn, astEl);
      case undefined:
        return new PartialBuilder(baseFS, this.refineThis, isNestIn, astEl);
    }
  }

  getOp(
    inputFS: SourceFieldSpace,
    isNestIn: QueryOperationSpace | undefined
  ): OpDesc {
    const build = this.getBuilder(inputFS, isNestIn, this);
    for (const qp of this.list) {
      build.execute(qp);
    }
    const segment = build.finalize(this.refineThis);
    return {
      segment,
      outputSpace: build.resultFS,
    };
  }
}
