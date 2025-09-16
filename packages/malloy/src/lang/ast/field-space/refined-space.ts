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

import type {FieldDef, StructDef} from '../../../model/malloy_types';
import {
  isJoined,
  type AccessModifierLabel,
  type Annotation,
  type DocumentLocation,
  type SourceDef,
} from '../../../model/malloy_types';
import type {FieldListEdit} from '../source-properties/field-list-edit';
import {DynamicSpace} from './dynamic-space';
import {canMakeEntry} from '../types/space-entry';
import type {MalloyElement} from '../types/malloy-element';
import type {ParameterSpace} from './parameter-space';
import {RenameSpaceField} from './rename-space-field';
import {SpaceField} from '../types/space-field';
import {
  getIncludeStateForJoin,
  type IncludeProcessingState,
} from './include-utils';

export class RefinedSpace extends DynamicSpace {
  /**
   * Factory for FieldSpace when there are accept/except edits
   * @param from A structdef which seeds this space
   * @param choose A accept/except edit of the "from" fields
   */
  static filteredFrom(
    from: SourceDef,
    choose: FieldListEdit | undefined,
    includeState: IncludeProcessingState,
    parameters: ParameterSpace | undefined
  ): RefinedSpace {
    const edited = new RefinedSpace({
      ...from,
      fields: editJoinsFromIncludeState([], from, includeState),
    });
    const renameMap = new Map<
      string,
      {as: string; location: DocumentLocation; logTo: MalloyElement}
    >();
    const s = getIncludeStateForJoin([], includeState);
    for (const rename of s.renames ?? []) {
      if (renameMap.has(rename.name.refString)) {
        rename.name.logError(
          'already-renamed',
          `${rename.name.refString} already renamed to ${rename.as}`
        );
      } else {
        renameMap.set(rename.name.refString, {
          as: rename.as,
          location: rename.location,
          logTo: rename.name,
        });
      }
    }
    if (s.fieldsToInclude !== undefined) {
      const oldMap = edited.entries();
      edited.dropEntries();
      for (const [symbol, value] of oldMap) {
        if (s.fieldsToInclude.has(symbol)) {
          const renamed = renameMap.get(symbol);
          if (renamed) {
            if (value instanceof SpaceField) {
              edited.setEntry(
                renamed.as,
                new RenameSpaceField(
                  value,
                  renamed.as,
                  renamed.location,
                  undefined
                )
              );
            } else {
              renamed.logTo.logError(
                'cannot-rename-non-field',
                `Cannot rename \`${symbol}\` which is not a field`
              );
            }
          } else {
            edited.setEntry(symbol, value);
          }
        }
      }
      if (choose !== undefined) {
        choose.logError(
          'accept-except-not-compatible-with-include',
          "Can't use `accept:` or `except:` with `include`"
        );
      }
    } else if (choose) {
      const names = choose.refs.list;
      const oldMap = edited.entries();
      for (const name of names) {
        const existing = oldMap.find(([symb]) => symb === name.refString);
        if (existing === undefined) {
          if (parameters?.entry(name.refString)) {
            name.logError(
              `${choose.edit}-parameter`,
              `Illegal \`${choose.edit}:\` of parameter`
            );
          } else {
            name.logError(
              'field-list-edit-not-found',
              `\`${name.refString}\` is not defined`
            );
          }
        }
      }
      edited.dropEntries();
      for (const [symbol, value] of oldMap) {
        const included = !!names.find(f => f.refString === symbol);
        const accepting = choose.edit === 'accept';
        if (included === accepting) {
          edited.setEntry(symbol, value);
        }
      }
    }
    return edited;
  }

  pushFields(...defs: MalloyElement[]): void {
    for (const me of defs) {
      this.addField(me);
    }
  }

  addField(def: MalloyElement): void {
    if (canMakeEntry(def)) {
      def.makeEntry(this);
    } else {
      def.logError(
        'unexpected-element-type',
        `Internal error, ${def.elementType} not expected in this context`
      );
    }
  }

  addAccessModifiers(ams: Map<string, AccessModifierLabel>): void {
    for (const [symbol, am] of ams) {
      this.newAccessModifiers.set(symbol, am);
    }
  }

  addNotes(notes: Map<string, Annotation>): void {
    for (const [symbol, note] of notes) {
      this.newNotes.set(symbol, note);
    }
  }

  accessProtectionLevel(): AccessModifierLabel {
    return 'internal';
  }
}

function editJoinsFromIncludeState(
  path: string[],
  from: StructDef,
  includeState: IncludeProcessingState
): FieldDef[] {
  let fields: FieldDef[];
  const joinedState = getIncludeStateForJoin(path, includeState);
  const isJoin = path.length > 0;
  if (isJoin) {
    if (joinedState.fieldsToInclude) {
      fields = from.fields.filter(
        f => joinedState.fieldsToInclude?.has(f.as ?? f.name)
      );
    } else {
      fields = from.fields;
    }
  } else {
    fields = from.fields;
  }
  // const fields = from.fields;
  const updatedFields: FieldDef[] = [];
  for (const field of fields) {
    const name = field.as ?? field.name;
    // TODO ensure you can't make it more permissive here...
    const accessModifier =
      joinedState.modifiers.get(name) ?? field.accessModifier;
    const notes = joinedState.notes.get(name);
    const rename = joinedState.renames.find(
      r => r.name.nameString === (field.as ?? field.name)
    );
    const editedField: FieldDef = isJoin
      ? {
          ...field,
          as: rename ? rename.name.nameString : field.as,
          accessModifier:
            accessModifier === 'public' ? undefined : accessModifier,
          annotation: notes
            ? {
                inherits: field.annotation,
                blockNotes: notes.blockNotes,
                notes: notes.notes,
              }
            : field.annotation,
        }
      : {...field};
    if (isJoined(editedField)) {
      updatedFields.push({
        ...editedField,
        fields: editJoinsFromIncludeState(
          [...path, field.as ?? field.name],
          editedField,
          includeState
        ),
      });
    } else {
      updatedFields.push(editedField);
    }
  }
  return updatedFields;
}
