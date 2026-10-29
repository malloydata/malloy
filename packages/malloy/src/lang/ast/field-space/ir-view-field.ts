/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryFieldDef, TurtleDef} from '../../../model/malloy_types';

import {ViewField} from './view-field';
import type {FieldSpace} from '../types/field-space';

export class IRViewField extends ViewField {
  constructor(
    fs: FieldSpace,
    protected turtleDef: TurtleDef
  ) {
    super(fs);
  }

  rename(name: string): void {
    this.turtleDef = {
      ...this.turtleDef,
      as: name,
    };
  }

  fieldDef(): TurtleDef {
    return this.turtleDef;
  }

  constructorFieldDef(): TurtleDef {
    return this.turtleDef;
  }

  getQueryFieldDef(_fs: FieldSpace): QueryFieldDef | undefined {
    return this.fieldDef();
  }
}
