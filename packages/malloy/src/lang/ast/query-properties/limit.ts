/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {MalloyElement} from '../types/malloy-element';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';

export class Limit extends MalloyElement implements QueryPropertyInterface {
  elementType = 'limit';
  queryRefinementStage = LegalRefinementStage.Tail;
  forceQueryClass = undefined;

  constructor(readonly limit: number) {
    super();
  }
}
