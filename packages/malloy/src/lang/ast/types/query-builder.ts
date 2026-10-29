/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FilterCondition, PipeSegment} from '../../../model/malloy_types';
import type {QueryProperty} from './query-property';
import type {QueryInputSpace} from '../field-space/query-input-space';
import type {QueryOperationSpace} from '../field-space/query-spaces';

export interface QueryBuilder {
  filters: FilterCondition[];
  type: 'grouping' | 'index' | 'project';
  inputFS: QueryInputSpace;
  resultFS: QueryOperationSpace;
  alwaysJoins: string[];
  requiredGroupBys: string[];
  execute(qp: QueryProperty): void;
  finalize(refineFrom: PipeSegment | undefined): PipeSegment;
}
