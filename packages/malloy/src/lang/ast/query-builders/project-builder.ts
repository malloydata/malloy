/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  PartialSegment,
  PipeSegment,
  ProjectSegment,
} from '../../../model/malloy_types';
import {isPartialSegment, isProjectSegment} from '../../../model/malloy_types';

import {ErrorFactory} from '../error-factory';
import type {SourceFieldSpace} from '../types/field-space';
import {ProjectFieldSpace} from '../field-space/project-field-space';
import type {QueryProperty} from '../types/query-property';
import {QuerySegmentBuilder} from './reduce-builder';
import type {QueryOperationSpace} from '../field-space/query-spaces';
import type {MalloyElement} from '../types/malloy-element';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryInputSpace} from '../field-space/query-input-space';

export class ProjectBuilder
  extends QuerySegmentBuilder
  implements QueryBuilder
{
  resultFS: ProjectFieldSpace;
  inputFS: QueryInputSpace;
  readonly type = 'project';

  constructor(
    baseFS: SourceFieldSpace,
    refineThis: PipeSegment | undefined,
    isNestIn: QueryOperationSpace | undefined,
    astEl: MalloyElement
  ) {
    super();
    this.resultFS = new ProjectFieldSpace(baseFS, refineThis, isNestIn, astEl);
    this.inputFS = this.resultFS.inputSpace();
  }

  execute(qp: QueryProperty): void {
    if (qp.elementType === 'having') {
      qp.logError(
        'illegal-operation-in-select-segment',
        'Illegal statement in a select query operation'
      );
    } else {
      super.execute(qp);
    }
  }

  finalize(fromSeg: PipeSegment | undefined): PipeSegment {
    let from: ProjectSegment | PartialSegment | undefined;
    if (fromSeg) {
      if (isProjectSegment(fromSeg) || isPartialSegment(fromSeg)) {
        from = fromSeg;
      } else {
        this.resultFS.logError(
          'incompatible-segment-for-select-refinement',
          `Can't refine select with ${fromSeg.type}`
        );
        return ErrorFactory.projectSegment;
      }
    }
    const projectSegment = this.resultFS.getQuerySegment(from);
    this.refineFrom(from, projectSegment);

    return projectSegment;
  }
}
