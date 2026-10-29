/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReferences} from '../query-items/field-references';
import type {FieldName} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {QueryClass} from '../types/query-property-interface';

export class Index extends MalloyElement implements QueryPropertyInterface {
  elementType = 'index';
  weightBy?: FieldName;
  forceQueryClass = QueryClass.Index;
  statement = 'index:';
  queryRefinementStage = undefined;

  constructor(readonly fields: FieldReferences) {
    super({fields: fields});
  }

  useWeight(fn: FieldName): void {
    this.has({weightBy: fn});
    this.weightBy = fn;
  }
}
