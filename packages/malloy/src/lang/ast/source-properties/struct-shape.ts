/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Annotation,
  AtomicTypeDef,
  StructShapeFieldDef,
} from '../../../model/malloy_types';
import {
  isStructShapeDef,
  mkArrayTypeDef,
  mkFieldDef,
} from '../../../model/malloy_types';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

export abstract class StructMember extends MalloyElement implements Noteable {
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;
  constructor(readonly name: string) {
    super();
  }
  abstract structShapeFieldDef(): StructShapeFieldDef;
}

export class StructMemberDef extends StructMember {
  elementType = 'structMemberDef';
  constructor(
    name: string,
    readonly typeDef: AtomicTypeDef
  ) {
    super(name);
  }
  structShapeFieldDef(): StructShapeFieldDef {
    const field: StructShapeFieldDef = {
      name: this.name,
      typeDef: this.typeDef,
    };
    if (this.note) {
      field.annotation = this.note;
    }
    return field;
  }
}

export class StructMemberIndirect extends StructMember {
  elementType = 'structMemberIndirect';
  constructor(
    name: string,
    readonly shapeName: string,
    readonly arrayDepth: number = 0
  ) {
    super(name);
  }
  structShapeFieldDef(): StructShapeFieldDef {
    const error: StructShapeFieldDef = {
      name: this.name,
      typeDef: {type: 'error'},
    };
    const doc = this.document();
    if (doc === undefined) {
      return error;
    }
    const modelEntry = doc.modelEntry(this.shapeName);
    if (modelEntry === undefined) {
      this.logError(
        'struct-not-found',
        `Struct '${this.shapeName}' is not defined`
      );
      return error;
    }
    if (!isStructShapeDef(modelEntry.entry)) {
      this.logError('not-a-struct', `'${this.shapeName}' is not a struct`);
      return error;
    }
    const fieldsFromReferencedType = modelEntry.entry.fields.map(f =>
      mkFieldDef(f.typeDef, f.name)
    );
    let typeDef: AtomicTypeDef = {
      type: 'record',
      fields: fieldsFromReferencedType,
    };
    for (let i = 0; i < this.arrayDepth; i++) {
      typeDef = mkArrayTypeDef(typeDef);
    }
    const field: StructShapeFieldDef = {name: this.name, typeDef};
    if (this.note) {
      field.annotation = modelEntry.entry.annotation
        ? {...this.note, inherits: modelEntry.entry.annotation}
        : this.note;
    } else if (modelEntry.entry.annotation) {
      field.annotation = {inherits: modelEntry.entry.annotation};
    }
    return field;
  }
}

export class StructShape extends ListOf<StructMember> {
  elementType = 'structShape';
  structShapeFieldDefs(): StructShapeFieldDef[] {
    return this.elements.map(member => member.structShapeFieldDef());
  }
}
