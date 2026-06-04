/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TypeDesc} from '../../../model/malloy_types';
import {
  expressionIsAggregate,
  expressionInvolvesAggregate,
  expressionIsAnalytic,
  TD,
} from '../../../model/malloy_types';

import {QuerySpace} from './query-spaces';

export class ProjectFieldSpace extends QuerySpace {
  readonly segmentType = 'project';

  canContain(typeDesc: TypeDesc | undefined): boolean {
    if (
      typeDesc === undefined ||
      !TD.isAtomic(typeDesc) ||
      expressionIsAggregate(typeDesc.expressionType)
    ) {
      // We don't need to log here, because an error should have already been logged.
      return false;
    }
    // TODO it would be really nice to attach this error message to the specific field,
    // rather than the whole query.
    if (
      expressionInvolvesAggregate(typeDesc.expressionType) &&
      expressionIsAnalytic(typeDesc.expressionType)
    ) {
      this.logError(
        'aggregate-analytic-in-select',
        'Cannot add aggregate analyics to select'
      );
      return false;
    }
    return true;
  }
}
