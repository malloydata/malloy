/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DocStatement, Document} from '../types/malloy-element';
import {MalloyElement, DocStatementList} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import type {
  Annotation,
  StructShapeDef,
  StructShapeFieldDef,
} from '../../../model/malloy_types';
import {isStructShapeDef} from '../../../model/malloy_types';
import type {StructMember} from '../source-properties/struct-shape';
import {StructShape} from '../source-properties/struct-shape';

export class ExtendedStructShape extends StructShape {
  type = 'extendedStructShape';
  constructor(
    parts: StructMember[],
    readonly extendName: string
  ) {
    super(parts);
  }

  structShapeFieldDefs(): StructShapeFieldDef[] {
    const doc = this.document();
    const baseFields = new Map<string, StructShapeFieldDef>();
    if (doc) {
      const modelEntry = doc.modelEntry(this.extendName);
      if (modelEntry === undefined) {
        this.logError(
          'struct-not-found',
          `Struct '${this.extendName}' is not defined`
        );
      } else if (!isStructShapeDef(modelEntry.entry)) {
        this.logError('not-a-struct', `'${this.extendName}' is not a struct`);
      } else {
        for (const f of modelEntry.entry.fields) {
          baseFields.set(f.name, f);
        }
      }
    }
    for (const f of super.structShapeFieldDefs()) {
      baseFields.set(f.name, f);
    }
    return [...baseFields.values()];
  }
}

export class DefineStruct
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'defineStruct';
  constructor(
    readonly name: string,
    readonly shapeDef: StructShape,
    readonly exported: boolean
  ) {
    super();
    this.has({shapeDef});
  }
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): void {
    if (doc.modelEntry(this.name)) {
      this.logError(
        'struct-definition-name-conflict',
        `Cannot redefine '${this.name}'`
      );
      return;
    }
    const fields = this.shapeDef.structShapeFieldDefs();
    if (fields === undefined) {
      return;
    }
    const entry: StructShapeDef = {
      type: 'structShape',
      name: this.name,
      fields,
      location: this.location,
    };
    if (this.note) {
      entry.annotation = this.note;
    }
    doc.setEntry(this.name, {entry, exported: this.exported});
  }
}

export class DefineStructList extends DocStatementList {
  elementType = 'defineStructs';
  constructor(structList: DefineStruct[]) {
    super(structList);
  }
}
