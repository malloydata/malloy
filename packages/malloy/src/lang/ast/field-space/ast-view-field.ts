/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryFieldDef, TurtleDef} from '../../../model/malloy_types';
import type {ViewFieldDeclaration} from '../source-properties/view-field-declaration';
import type {FieldSpace} from '../types/field-space';
import {ViewField} from './view-field';

export class ASTViewField extends ViewField {
  constructor(
    fs: FieldSpace,
    readonly view: ViewFieldDeclaration,
    protected name: string
  ) {
    super(fs);
  }

  getQueryFieldDef(fs: FieldSpace): QueryFieldDef {
    return this.view.getFieldDef(fs);
  }

  private turtleDef: TurtleDef | undefined = undefined;
  fieldDef(): TurtleDef {
    if (this.turtleDef === undefined) {
      this.turtleDef = this.view.getFieldDef(this.inSpace);
    }
    return this.turtleDef;
  }
}
