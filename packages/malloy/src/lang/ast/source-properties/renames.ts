/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {AccessModifierLabel, Annotation} from '../../../model';
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
  note?: Annotation;
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
            this.note
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
