/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
