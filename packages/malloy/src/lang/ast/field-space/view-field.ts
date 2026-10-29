/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  QueryFieldDef,
  TurtleDef,
  TypeDesc,
} from '../../../model/malloy_types';

import type {FieldSpace} from '../types/field-space';
import {SpaceField} from '../types/space-field';

export abstract class ViewField extends SpaceField {
  constructor(protected inSpace: FieldSpace) {
    super();
  }

  abstract getQueryFieldDef(fs: FieldSpace): QueryFieldDef | undefined;
  abstract fieldDef(): TurtleDef;

  typeDesc(): TypeDesc {
    const fieldDef = this.fieldDef();
    return this.turtleTypeFromTurtleDef(fieldDef);
  }
}
