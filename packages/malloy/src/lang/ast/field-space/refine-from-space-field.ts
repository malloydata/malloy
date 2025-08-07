/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  TypeDesc,
  AtomicFieldDef,
  QueryFieldDef,
  TurtleDef,
} from '../../../model/malloy_types';
import type {FieldSpace} from '../types/field-space';

import {SpaceField} from '../types/space-field';

export class RefineFromSpaceField extends SpaceField {
  constructor(private readonly refineFromFieldDef: AtomicFieldDef | TurtleDef) {
    super();
  }

  getQueryFieldDef(_fs: FieldSpace): QueryFieldDef | undefined {
    return this.refineFromFieldDef;
  }

  typeDesc(): TypeDesc {
    return this.typeFromFieldDef(this.refineFromFieldDef);
  }
}
