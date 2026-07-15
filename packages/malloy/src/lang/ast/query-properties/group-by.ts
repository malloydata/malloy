/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DefinitionList} from '../types/definition-list';
import type {QueryItem} from '../types/query-item';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';

export class GroupBy
  extends DefinitionList<QueryItem>
  implements QueryPropertyInterface
{
  elementType = 'groupBy';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;
  statement = 'group_by:';
}
