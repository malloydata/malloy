/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DefinitionList} from '../types/definition-list';
import type {QueryItem} from '../types/query-item';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

export class Calculate
  extends DefinitionList<QueryItem>
  implements QueryPropertyInterface
{
  elementType = 'calculate';
  forceQueryClass = undefined;
  needsExplicitQueryClass = true;
  queryRefinementStage = LegalRefinementStage.Single;
}
