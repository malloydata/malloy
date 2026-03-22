/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Annotation,
  AtomicTypeDef,
  UserTypeFieldDef,
} from '../../../model/malloy_types';
import {
  isUserTypeDef,
  mkArrayTypeDef,
  mkFieldDef,
} from '../../../model/malloy_types';
import {ListOf, MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

export abstract class UserTypeMember extends MalloyElement implements Noteable {
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;
  constructor(readonly name: string) {
    super();
  }
  abstract userTypeFieldDef(): UserTypeFieldDef;
}

export class UserTypeMemberDef extends UserTypeMember {
  elementType = 'userTypeMemberDef';
  constructor(
    name: string,
    readonly typeDef: AtomicTypeDef
  ) {
    super(name);
  }
  userTypeFieldDef(): UserTypeFieldDef {
    const field: UserTypeFieldDef = {
      name: this.name,
      typeDef: this.typeDef,
    };
    if (this.note) {
      field.annotation = this.note;
    }
    return field;
  }
}

export class UserTypeMemberIndirect extends UserTypeMember {
  elementType = 'userTypeMemberIndirect';
  constructor(
    name: string,
    readonly shapeName: string,
    readonly arrayDepth: number = 0
  ) {
    super(name);
  }
  userTypeFieldDef(): UserTypeFieldDef {
    const error: UserTypeFieldDef = {
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
        'user-type-not-found',
        `User type '${this.shapeName}' is not defined`
      );
      return error;
    }
    if (!isUserTypeDef(modelEntry.entry)) {
      this.logError(
        'not-a-user-type',
        `'${this.shapeName}' is not a user type`
      );
      return error;
    }
    const fieldsFromReferencedType = modelEntry.entry.fields.map(f => {
      const field = mkFieldDef(f.typeDef, f.name);
      if (f.annotation) {
        field.annotation = f.annotation;
      }
      return field;
    });
    let typeDef: AtomicTypeDef = {
      type: 'record',
      fields: fieldsFromReferencedType,
    };
    for (let i = 0; i < this.arrayDepth; i++) {
      typeDef = mkArrayTypeDef(typeDef);
    }
    const field: UserTypeFieldDef = {name: this.name, typeDef};
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

export class UserTypeShape extends ListOf<UserTypeMember> {
  elementType = 'userTypeShape';
  userTypeFieldDefs(): UserTypeFieldDef[] {
    return this.elements.map(member => member.userTypeFieldDef());
  }
}
