/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AccessModifierLabel, AnnotationsDef} from '../../../model';
import type {DynamicSpace} from '../field-space/dynamic-space';
import {RenameSpaceField} from '../field-space/rename-space-field';
import {DefinitionList} from '../types/definition-list';
import type {FieldName} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {extendNoteMethod, type Noteable} from '../types/noteable';
import type {MakeEntry} from '../types/space-entry';
import {SpaceField} from '../types/space-field';

export class RenameField extends MalloyElement implements Noteable, MakeEntry {
  elementType = 'renameField';
  note?: AnnotationsDef;
  extendNote = extendNoteMethod;
  readonly isNoteableObj = true;

  constructor(
    readonly newName: string,
    readonly oldName: FieldName
  ) {
    super();
    this.has({oldName: oldName});
  }

  makeEntry(fs: DynamicSpace) {
    if (this.oldName.refString === this.newName) {
      this.logError(
        'invalid-rename-with-same-name',
        "Can't rename field to itself"
      );
      return;
    }

    // Check if the new name would shadow an existing field
    if (fs.entry(this.newName)) {
      this.logError(
        'invalid-rename-with-same-name',
        `Can't rename to '${this.newName}', field already exists`
      );
      return;
    }

    const oldValue = this.oldName.getField(fs);
    /*

    ok need to get the annotation from the old field into the inherits and the annotaiton
    of the curuent field and then





    */
    if (oldValue.found) {
      if (oldValue.found instanceof SpaceField) {
        fs.renameEntry(
          this.oldName.refString,
          this.newName,
          new RenameSpaceField(
            oldValue.found,
            this.newName,
            this.location,
            this.note ? {...this.note} : undefined
          )
        );
      } else {
        this.logError('failed-rename', `'${this.oldName}' cannot be renamed`);
      }
    } else {
      this.logError(
        'rename-field-not-found',
        `Can't rename '${this.oldName}', no such field`
      );
    }
  }

  getName(): string {
    return this.newName;
  }
}

export class Renames extends DefinitionList<RenameField> {
  elementType = 'renameFields';

  constructor(
    fields: RenameField[],
    readonly accessModifier: AccessModifierLabel | undefined
  ) {
    super(fields);
  }

  get delarationNames(): string[] {
    return this.list.map(el => el.getName());
  }
}
