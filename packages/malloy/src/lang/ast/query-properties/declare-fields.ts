/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AccessModifierLabel} from '../../../model';
import type {AtomicFieldDeclaration} from '../query-items/field-declaration';
import {DefinitionList} from '../types/definition-list';
import type {QueryBuilder} from '../types/query-builder';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

export abstract class DeclareFields
  extends DefinitionList<AtomicFieldDeclaration>
  implements QueryPropertyInterface
{
  elementType = 'declareFields';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = undefined;

  constructor(
    fields: AtomicFieldDeclaration[],
    readonly accessModifier: AccessModifierLabel | undefined
  ) {
    super(fields);
  }

  queryExecute(executeFor: QueryBuilder): void {
    for (const qel of this.list) {
      executeFor.inputFS.extendSource(qel);
    }
  }

  get delarationNames(): string[] {
    return this.list.map(el => el.defineName);
  }
}
