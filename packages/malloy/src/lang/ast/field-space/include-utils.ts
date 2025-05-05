/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  AccessModifierLabel,
  Annotation,
  DocumentLocation,
  FieldDef,
  SourceDef,
} from '../../../model/malloy_types';
import {isJoined} from '../../../model/malloy_types';
import type {IncludeItem} from '../source-query-elements/include-item';
import {
  IncludeAccessItem,
  IncludeExceptItem,
} from '../source-query-elements/include-item';
import type {FieldReference} from '../query-items/field-references';
import {WildcardFieldReference} from '../query-items/field-references';
import {pathEq} from '../../../model/composite_source_utils';
import type {MalloyElement} from '../types/malloy-element';

export interface JoinIncludeProcessingState {
  star: AccessModifierLabel | 'inherit' | undefined;
  starNote: Annotation | undefined;
  mode: 'exclude' | 'include' | undefined;
  fieldsMentioned: Set<string>;
  allFields: Set<string>;
  alreadyPrivateFields: Set<string>;
  modifiers: Map<string, AccessModifierLabel>;
  renames: {
    as: string;
    name: FieldReference;
    location: DocumentLocation;
  }[];
  fieldsToInclude: Set<string> | undefined;
  notes: Map<string, Annotation>;
}

export interface IncludeProcessingState {
  joins: {
    path: string[];
    state: JoinIncludeProcessingState;
  }[];
}

function getJoinFields(
  from: SourceDef,
  joinPath: string[],
  logTo: MalloyElement
): FieldDef[] {
  let fields = from.fields;
  for (const joinName of joinPath) {
    const join = fields.find(f => (f.as ?? f.name) === joinName);
    if (join === undefined) {
      logTo.logError('field-not-found', `\`${joinName}\` not found`);
      return [];
    }
    if (!isJoined(join)) {
      logTo.logError('field-not-found', `\`${joinName}\` is not a join`);
      return [];
    }
    fields = join.fields;
  }
  return fields;
}

export function getIncludeStateForJoin(
  joinPath: string[],
  state: IncludeProcessingState
): JoinIncludeProcessingState {
  const joinState = state.joins.find(s => pathEq(s.path, joinPath));
  if (joinState !== undefined) return joinState.state;
  return {
    star: undefined,
    starNote: undefined,
    mode: undefined,
    fieldsMentioned: new Set(),
    allFields: new Set(),
    alreadyPrivateFields: new Set(),
    modifiers: new Map(),
    renames: [],
    notes: new Map(),
    fieldsToInclude: undefined,
  };
}

function getOrCreateIncludeStateForJoin(
  joinPath: string[],
  state: IncludeProcessingState,
  from: SourceDef,
  logTo: MalloyElement
): JoinIncludeProcessingState {
  const joinState = state.joins.find(s => pathEq(s.path, joinPath));
  if (joinState !== undefined) return joinState.state;
  else {
    const fromFields = getJoinFields(from, joinPath, logTo);
    const allFields = new Set(fromFields.map(f => f.as ?? f.name));
    const alreadyPrivateFields = new Set(
      fromFields
        .filter(f => f.accessModifier === 'private')
        .map(f => f.as ?? f.name)
    );
    const joinState: JoinIncludeProcessingState = {
      star: undefined,
      starNote: undefined,
      mode: undefined,
      fieldsMentioned: new Set(),
      allFields,
      alreadyPrivateFields,
      modifiers: new Map(),
      renames: [],
      notes: new Map(),
      fieldsToInclude: new Set(),
    };
    state.joins.push({path: [...joinPath], state: joinState});
    return joinState;
  }
}

export function processIncludeList(
  includeItems: IncludeItem[] | undefined,
  from: SourceDef
): IncludeProcessingState {
  const state: IncludeProcessingState = {joins: []};
  if (includeItems === undefined) {
    return state;
  }
  for (const item of includeItems) {
    if (item instanceof IncludeAccessItem) {
      for (const f of item.fields) {
        const joinPath =
          f.name instanceof WildcardFieldReference
            ? f.name.joinPath?.path ?? []
            : f.name.path.slice(0, -1);
        const joinState = getOrCreateIncludeStateForJoin(
          joinPath,
          state,
          from,
          f
        );

        if (f.name instanceof WildcardFieldReference) {
          if (joinState.star !== undefined) {
            item.logError(
              'already-used-star-in-include',
              'Wildcard already used in this include block'
            );
          } else {
            joinState.star = item.kind ?? 'inherit';
            joinState.starNote = {
              notes: f.note?.notes ?? [],
              blockNotes: item.note?.blockNotes ?? [],
            };
          }
        } else {
          if (!joinState.allFields.has(f.name.getName())) {
            item.logError(
              'field-not-found',
              `\`${f.name.refString}\` not found`
            );
            continue;
          }
          if (joinState.mode === 'exclude') {
            item.logError(
              'include-after-exclude',
              'Cannot include specific fields if specific fields are already excluded'
            );
            continue;
          }
          joinState.mode = 'include';
          const name = f.name.nameString;
          if (joinState.alreadyPrivateFields.has(name)) {
            f.logError(
              'cannot-expand-access',
              `Cannot expand access of \`${name}\` from private to ${item.kind}`
            );
          }
          if (joinState.modifiers.has(name)) {
            f.logError(
              'duplicate-include',
              `Field \`${name}\` already referenced in include list`
            );
          } else {
            if (item.kind !== undefined) {
              joinState.modifiers.set(name, item.kind);
            }
            joinState.fieldsMentioned.add(name);
            if (f.note || item.note) {
              joinState.notes.set(name, {
                notes: f.note?.notes ?? [],
                blockNotes: item.note?.blockNotes ?? [],
              });
            }
          }
          if (f.as) {
            if (f.name instanceof WildcardFieldReference) {
              f.logError(
                'wildcard-include-rename',
                'Cannot rename a wildcard field in an `include` block'
              );
            } else {
              joinState.renames.push({
                name: f.name,
                as: f.as,
                location: f.location,
              });
            }
          }
        }
      }
    } else if (item instanceof IncludeExceptItem) {
      for (const f of item.fields) {
        const joinPath =
          f instanceof WildcardFieldReference
            ? f.joinPath?.path ?? []
            : f.path.slice(0, -1);
        const joinState = getOrCreateIncludeStateForJoin(
          joinPath,
          state,
          from,
          f
        );
        if (f instanceof WildcardFieldReference) {
          f.logWarning(
            'wildcard-except-redundant',
            '`except: *` is implied, unless another clause uses *'
          );
        } else {
          if (!joinState.allFields.has(f.getName())) {
            item.logError('field-not-found', `\`${f.refString}\` not found`);
          } else if (joinState.mode === 'include') {
            item.logError(
              'exclude-after-include',
              'Cannot exclude specific fields if specific fields are already included'
            );
          } else {
            joinState.mode = 'exclude';
            joinState.star = 'inherit';
            joinState.fieldsMentioned.add(f.nameString);
          }
        }
      }
    }
  }
  for (const join of state.joins) {
    const joinState = join.state;
    const starFields: Set<string> = new Set(joinState.allFields);
    joinState.fieldsMentioned.forEach(f => starFields.delete(f));
    joinState.alreadyPrivateFields.forEach(f => starFields.delete(f));
    if (joinState.star !== undefined) {
      for (const field of starFields) {
        if (joinState.star !== 'inherit') {
          joinState.modifiers.set(field, joinState.star);
        }
        if (joinState.starNote) {
          joinState.notes.set(field, {...joinState.starNote});
        }
      }
    }
    if (joinState.mode !== 'exclude') {
      if (joinState.star !== undefined) {
        joinState.fieldsToInclude = joinState.allFields;
      } else {
        joinState.fieldsToInclude = joinState.fieldsMentioned;
      }
    } else {
      joinState.fieldsToInclude = starFields;
    }
  }
  // TODO: validate that a field isn't renamed more than once
  // TODO: validate that excluded fields are not referenced by included fields
  // TODO: make renames fields work in existing references
  // TODO: make renames that would replace an excluded field don't do that
  return state;
}
