/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {DefinitionList} from '../types/definition-list';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  QueryClass,
  LegalRefinementStage,
} from '../types/query-property-interface';
import type {NestFieldDeclaration} from './nest';

export class Nests
  extends DefinitionList<NestFieldDeclaration>
  implements QueryPropertyInterface
{
  elementType = 'nestedQueries';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;
  statement = 'nest:';
  constructor(nests: NestFieldDeclaration[]) {
    super(nests);
  }
}
