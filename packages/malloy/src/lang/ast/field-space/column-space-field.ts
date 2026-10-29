/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TypeDesc, AtomicFieldDef} from '../../../model/malloy_types';

import {SpaceField} from '../types/space-field';

export class ColumnSpaceField<T extends AtomicFieldDef> extends SpaceField {
  constructor(public sourceFieldDef: T) {
    super();
  }

  fieldDef(): T {
    return this.sourceFieldDef;
  }

  typeDesc(): TypeDesc {
    return this.fieldTypeFromFieldDef(this.sourceFieldDef);
  }

  constructorFieldDef(): T {
    return this.sourceFieldDef;
  }
}
