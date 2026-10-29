/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Sampling} from '../../../model/malloy_types';

import {MalloyElement} from '../types/malloy-element';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';

export class SampleProperty
  extends MalloyElement
  implements QueryPropertyInterface
{
  elementType = 'sampleProperty';
  queryRefinementStage = LegalRefinementStage.Tail;
  forceQueryClass = QueryClass.Index;
  statement = 'sample:';

  constructor(readonly sample: Sampling) {
    super();
  }
  sampling(): Sampling {
    return this.sample;
  }
}
