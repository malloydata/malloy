/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryBuilder} from '../types/query-builder';
import {ListOf} from '../types/malloy-element';
import type {QueryExtendProperty} from '../types/query-extend-property';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

export class ExtendBlock
  extends ListOf<QueryExtendProperty>
  implements QueryPropertyInterface
{
  elementType = 'extendBlock';
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Single;

  queryExecute(executeFor: QueryBuilder): void {
    for (const block of this.list) {
      for (const qel of block.list) {
        executeFor.inputFS.extendSource(qel);
      }
    }
  }
}
