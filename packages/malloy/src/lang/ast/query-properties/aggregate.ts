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

export class Aggregate
  extends DefinitionList<QueryItem>
  implements QueryPropertyInterface
{
  elementType = 'aggregateList';
  readonly queryRefinementStage = LegalRefinementStage.Single;
  readonly forceQueryClass = QueryClass.Grouping;
  readonly statement = 'aggregate:';
}
