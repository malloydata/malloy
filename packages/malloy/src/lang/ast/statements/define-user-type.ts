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
  UserTypeDef,
  UserTypeFieldDef,
} from '../../../model/malloy_types';
import {isUserTypeDef} from '../../../model/malloy_types';
import type {UserTypeMember} from '../source-properties/user-type-shape';
import {UserTypeShape} from '../source-properties/user-type-shape';

export class ExtendedUserTypeShape extends UserTypeShape {
  type = 'extendedUserTypeShape';
  constructor(
    parts: UserTypeMember[],
    readonly extendName: string
  ) {
    super(parts);
  }

  userTypeFieldDefs(): UserTypeFieldDef[] {
    const doc = this.document();
    const baseFields = new Map<string, UserTypeFieldDef>();
    if (doc) {
      const modelEntry = doc.modelEntry(this.extendName);
      if (modelEntry === undefined) {
        this.logError(
          'user-type-not-found',
          `User type '${this.extendName}' is not defined`
        );
      } else if (!isUserTypeDef(modelEntry.entry)) {
        this.logError(
          'not-a-user-type',
          `'${this.extendName}' is not a user type`
        );
      } else {
        for (const f of modelEntry.entry.fields) {
          baseFields.set(f.name, f);
        }
      }
    }
    for (const f of super.userTypeFieldDefs()) {
      baseFields.set(f.name, f);
    }
    return [...baseFields.values()];
  }
}

export class DefineUserType
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'defineUserType';
  constructor(
    readonly name: string,
    readonly shapeDef: UserTypeShape,
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
        'user-type-definition-name-conflict',
        `Cannot redefine '${this.name}'`
      );
      return;
    }
    const fields = this.shapeDef.userTypeFieldDefs();
    if (fields === undefined) {
      return;
    }
    const entry: UserTypeDef = {
      type: 'userType',
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

export class DefineUserTypeList extends DocStatementList {
  elementType = 'defineUserTypes';
  constructor(userTypeList: DefineUserType[]) {
    super(userTypeList);
  }
}
