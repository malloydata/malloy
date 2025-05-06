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
  StructDef,
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
  star: AccessModifierLabel | 'inherit' | 'except' | undefined;
  starNote: Annotation | undefined;
  fieldsIncluded: Set<string>;
  joinNames: Set<string>;
  fieldsExcepted: Set<string>;
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
    joinNames: new Set(),
    fieldsIncluded: new Set(),
    fieldsExcepted: new Set(),
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
    const joinNames = new Set(
      fromFields.filter(f => isJoined(f)).map(f => f.as ?? f.name)
    );
    const alreadyPrivateFields = new Set(
      fromFields
        .filter(f => f.accessModifier === 'private')
        .map(f => f.as ?? f.name)
    );
    const joinState: JoinIncludeProcessingState = {
      star: undefined,
      joinNames,
      starNote: undefined,
      fieldsIncluded: new Set(),
      fieldsExcepted: new Set(),
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

function checkParents(
  state: IncludeProcessingState,
  joinPath: string[],
  from: SourceDef,
  f: MalloyElement,
  kind: AccessModifierLabel | 'except' | undefined
) {
  for (let prefixLength = 0; prefixLength < joinPath.length; prefixLength++) {
    const parentPath = joinPath.slice(0, prefixLength);
    const joinName = joinPath[prefixLength];
    const parentState = getOrCreateIncludeStateForJoin(
      parentPath,
      state,
      from,
      f
    );
    if (parentState.fieldsExcepted.has(joinName)) {
      const action = kind === 'except' ? 'exclude' : 'include';
      f.logError(
        'include-after-exclude',
        `Cannot ${action} fields from \`${joinName}\` when \`${joinName}\` is itself excepted`
      );
      continue;
    } else if (
      parentState.alreadyPrivateFields.has(joinName) ||
      parentState.modifiers.get(joinName) === 'private'
    ) {
      f.logError('field-not-accessible', `\`${joinName}\` is private`);
      continue;
    } else if (kind === 'public') {
      parentState.modifiers.set(joinName, 'public');
    }
    parentState.fieldsIncluded.add(joinName);
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
        checkParents(state, joinPath, from, f, item.kind);

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
          const name = f.name.nameString;
          if (joinState.joinNames.has(name)) {
            const joinJoinState = getIncludeStateForJoin(
              [...joinPath, name],
              state
            );
            if (item.kind === 'private') {
              // If we're making a join private, we need to make sure we didn't also make any
              // of its fields public or internal
              if (
                Object.values(joinJoinState.modifiers).some(
                  m => m === 'public' || m === 'internal'
                ) ||
                joinJoinState.star === 'internal' ||
                joinJoinState.star === 'public'
              ) {
                f.logError(
                  'cannot-expand-access',
                  `Cannot make \`${name}\` and also make fields in \`${name}\` public or internal`
                );
                continue;
              }
            }
          }
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
              joinState.modifiers.set(f.as ?? name, item.kind);
            }
            joinState.fieldsIncluded.add(name);
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
              if (joinPath.length > 0) {
                f.logError(
                  'cannot-rename-join-field',
                  'Cannot rename a joined field in an `include` block'
                );
              }
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
        checkParents(state, joinPath, from, f, item.kind);
        if (f instanceof WildcardFieldReference) {
          if (joinState.star !== undefined) {
            item.logError(
              'already-used-star-in-include',
              'Wildcard already used in this include block'
            );
          } else {
            joinState.star = 'except';
          }
        } else {
          const name = f.getName();
          if (!joinState.allFields.has(name)) {
            item.logError('field-not-found', `\`${f.refString}\` not found`);
            continue;
          }
          if (joinState.joinNames.has(name)) {
            const joinJoinState = getIncludeStateForJoin(
              [...joinPath, name],
              state
            );
            const star = joinJoinState.star;
            if (
              joinJoinState.fieldsIncluded.size > 0 ||
              star === 'inherit' ||
              star === 'public' ||
              star === 'private' ||
              star === 'internal'
            ) {
              f.logError(
                'exclude-after-include',
                `Cannot except \`${name}\` when fields from \`${name}\` are already included`
              );
              continue;
            } else if (
              joinJoinState.fieldsExcepted.size > 0 ||
              star === 'except'
            ) {
              f.logError(
                'exclude-after-exclude',
                `Cannot except \`${name}\` when fields from \`${name}\` are already excepted`
              );
              continue;
            }
          }

          if (joinState.star === 'except') {
            item.logWarning(
              'except-star-and-list',
              'Excluding specific fields is unnecessary if also using `except: *`'
            );
          } else {
            joinState.fieldsExcepted.add(f.nameString);
          }
        }
      }
    }
  }
  for (const join of state.joins) {
    const joinState = join.state;
    const starFields: Set<string> = new Set(joinState.allFields);
    joinState.fieldsIncluded.forEach(f => starFields.delete(f));
    joinState.fieldsExcepted.forEach(f => starFields.delete(f));
    joinState.alreadyPrivateFields.forEach(f => starFields.delete(f));
    if (joinState.star === 'except') {
      joinState.fieldsToInclude = joinState.fieldsIncluded;
    } else {
      joinState.fieldsToInclude = new Set(joinState.allFields);
      for (const field of joinState.fieldsExcepted) {
        joinState.fieldsToInclude.delete(field);
      }
      for (const field of starFields) {
        if (joinState.star !== 'inherit') {
          joinState.modifiers.set(field, joinState.star ?? 'private');
        }
        if (joinState.starNote) {
          joinState.notes.set(field, {...joinState.starNote});
        }
      }
    }
  }
  // TODO: validate that a field isn't renamed more than once
  // TODO: validate that excluded fields are not referenced by included fields
  // TODO: make renames fields work in existing references
  // TODO: make renames that would replace an excluded field don't do that
  return state;
}
