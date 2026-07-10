/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DefinitionList} from '../types/definition-list';
import type {QueryBuilder} from '../types/query-builder';
import type {FieldCollectionMember} from '../types/field-collection-member';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';

export class ProjectStatement
  extends DefinitionList<FieldCollectionMember>
  implements QueryPropertyInterface
{
  elementType = 'projectStatement';
  forceQueryClass = QueryClass.Project;
  statement = 'select:';
  queryRefinementStage = LegalRefinementStage.Single;

  queryExecute(executeFor: QueryBuilder) {
    if (executeFor.type === 'project') {
      executeFor.resultFS.pushFields(...this.list);
    }
  }
}
