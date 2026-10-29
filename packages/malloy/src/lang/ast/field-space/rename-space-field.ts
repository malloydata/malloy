/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AnnotationsDef,
  DocumentLocation,
  FieldDef,
} from '../../../model/malloy_types';
import {activeName, mapFieldUsage} from '../../../model/malloy_types';

import {SpaceField} from '../types/space-field';

export class RenameSpaceField extends SpaceField {
  constructor(
    private readonly otherField: SpaceField,
    private readonly newName: string,
    private readonly location: DocumentLocation,
    private note: AnnotationsDef | undefined
  ) {
    super();
  }

  fieldDef(): FieldDef | undefined {
    const returnFieldDef = this.otherField.fieldDef();
    if (returnFieldDef === undefined) {
      return undefined;
    }
    if (this.note) {
      if (returnFieldDef.annotations) {
        returnFieldDef.annotations = {
          ...this.note,
          inherits: returnFieldDef.annotations,
        };
      } else {
        returnFieldDef.annotations = this.note;
      }
    }
    return {
      ...returnFieldDef,
      as: this.newName,
      location: this.location,
      refSummary: mapFieldUsage(returnFieldDef.refSummary, u => ({
        ...u,
        path:
          u.path[0] === activeName(returnFieldDef)
            ? [this.newName, ...u.path.slice(1)]
            : u.path,
      })),
    };
  }

  typeDesc() {
    return this.otherField.typeDesc();
  }
}
