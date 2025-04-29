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

import type {
  AccessModifierLabel,
  Annotation,
  DocumentLocation,
  SourceDef,
} from '../../../model/malloy_types';
import {expressionIsCalculation} from '../../../model/malloy_types';

import {RefinedSpace} from '../field-space/refined-space';
import type {HasParameter} from '../parameters/has-parameter';
import {DeclareFields} from '../query-properties/declare-fields';
import {Filter} from '../query-properties/filters';
import {FieldListEdit} from '../source-properties/field-list-edit';
import {PrimaryKey} from '../source-properties/primary-key';
import {Views} from '../source-properties/views';
import type {SourceDesc} from '../types/source-desc';
import {Source} from './source';
import {TimezoneStatement} from '../source-properties/timezone-statement';
import {ObjectAnnotation} from '../types/annotation-elements';
import {Renames} from '../source-properties/renames';
import type {MakeEntry} from '../types/space-entry';
import {ParameterSpace} from '../field-space/parameter-space';
import {JoinStatement} from '../source-properties/join';
import type {IncludeItem} from '../source-query-elements/include-item';
import {
  IncludeAccessItem,
  IncludeExceptItem,
} from '../source-query-elements/include-item';
import type {FieldReference} from '../query-items/field-references';
import {WildcardFieldReference} from '../query-items/field-references';

/**
 * A Source made from a source reference and a set of refinements
 */
export class RefinedSource extends Source {
  elementType = 'refinedSource';
  currentAnnotation?: Annotation;

  constructor(
    readonly source: Source,
    readonly refinement: SourceDesc,
    readonly includeList: IncludeItem[] | undefined
  ) {
    super({source, refinement});
    if (includeList) {
      this.has({includeList});
    }
  }

  getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef {
    return this.withParameters(parameterSpace, []);
  }

  withParameters(
    parameterSpace: ParameterSpace | undefined,
    pList: HasParameter[] | undefined
  ): SourceDef {
    let primaryKey: PrimaryKey | undefined;
    let fieldListEdit: FieldListEdit | undefined;
    const fields: MakeEntry[] = [];
    const filters: Filter[] = [];
    let newTimezone: string | undefined;

    const inlineAccessModifiers: {
      access: AccessModifierLabel;
      fields: string[];
    }[] = [];
    for (const el of this.refinement.list) {
      if (el instanceof ObjectAnnotation) {
        // Treat lone annotations as comments
        continue;
      }
      const errTo = el;
      if (el instanceof PrimaryKey) {
        if (primaryKey) {
          const code = 'multiple-primary-keys';
          primaryKey.logError(code, 'Primary key already defined');
          el.logError(code, 'Primary key redefined');
        }
        primaryKey = el;
      } else if (el instanceof FieldListEdit) {
        if (fieldListEdit) {
          const code = 'multiple-field-list-edits';
          fieldListEdit.logError(code, 'Too many accept/except statements');
          el.logError(code, 'Too many accept/except statements');
        }
        fieldListEdit = el;
      } else if (
        el instanceof DeclareFields ||
        el instanceof JoinStatement ||
        el instanceof Views ||
        el instanceof Renames
      ) {
        fields.push(...el.list);
        if (el.accessModifier) {
          inlineAccessModifiers.push({
            fields: el.delarationNames,
            access: el.accessModifier,
          });
        }
      } else if (el instanceof Filter) {
        filters.push(el);
      } else if (el instanceof TimezoneStatement) {
        newTimezone = el.tz;
      } else {
        errTo.logError(
          'unexpected-source-property',
          `Unexpected source property: '${errTo.elementType}'`
        );
      }
    }

    const paramSpace = pList ? new ParameterSpace(pList) : undefined;
    const from = structuredClone(this.source.getSourceDef(paramSpace));
    const {fieldsToInclude, modifiers, renames, notes} = processIncludeList(
      this.includeList,
      from
    );
    for (const modifier of inlineAccessModifiers) {
      for (const field of modifier.fields) {
        modifiers.set(field, modifier.access);
      }
    }
    // Note that this is explicitly not:
    // const from = structuredClone(this.source.withParameters(parameterSpace, pList));
    // Because the parameters are added to the resulting struct, not the base struct
    if (primaryKey) {
      from.primaryKey = primaryKey.field.name;
    }
    const fs = RefinedSpace.filteredFrom(
      from,
      fieldListEdit,
      fieldsToInclude,
      renames,
      paramSpace
    );
    if (newTimezone) {
      fs.setTimezone(newTimezone);
    }
    if (pList) {
      fs.addParameters(pList);
    }
    fs.pushFields(...fields);
    if (primaryKey) {
      const keyDef = primaryKey.field.getField(fs);
      if (keyDef.error) {
        primaryKey.logError(keyDef.error.code, keyDef.error.message);
      }
    }
    fs.addAccessModifiers(modifiers);
    fs.addNotes(notes);
    const retStruct = fs.structDef();

    const filterList = retStruct.filterList || [];
    let moreFilters = false;
    for (const filter of filters) {
      for (const el of filter.list) {
        const fc = el.filterCondition(fs);
        if (expressionIsCalculation(fc.expressionType)) {
          el.logError(
            'aggregate-in-source-filter',
            "Can't use aggregate computations in top level filters"
          );
        } else {
          filterList.push(fc);
          moreFilters = true;
        }
      }
    }
    if (moreFilters) {
      return {...retStruct, filterList};
    }
    this.document()?.rememberToAddModelAnnotations(retStruct);
    return retStruct;
  }
}

function processIncludeList(
  includeItems: IncludeItem[] | undefined,
  from: SourceDef
) {
  // TODO error/warning if you include both star and specific fields with the same modifier...
  const allFields = new Set(from.fields.map(f => f.name));
  const alreadyPrivateFields = new Set(
    from.fields.filter(f => f.accessModifier === 'private').map(f => f.name)
  );
  let mode: 'exclude' | 'include' | undefined = undefined;
  const fieldsMentioned = new Set<string>();
  let star: AccessModifierLabel | 'inherit' | undefined = undefined;
  let starNote: Annotation | undefined = undefined;
  const modifiers = new Map<string, AccessModifierLabel>();
  const renames: {
    as: string;
    name: FieldReference;
    location: DocumentLocation;
  }[] = [];
  const notes = new Map<string, Annotation>();
  if (includeItems === undefined) {
    return {fieldsToInclude: undefined, modifiers, renames, notes};
  }
  for (const item of includeItems) {
    if (item instanceof IncludeAccessItem) {
      for (const f of item.fields) {
        if (f.name instanceof WildcardFieldReference) {
          if (f.name.joinPath) {
            f.logError(
              'unsupported-path-in-include',
              'Wildcards with paths are not supported in `include` blocks'
            );
          }
          if (star !== undefined) {
            item.logError(
              'already-used-star-in-include',
              'Wildcard already used in this include block'
            );
          } else {
            star = item.kind ?? 'inherit';
            starNote = {
              notes: f.note?.notes ?? [],
              blockNotes: item.note?.blockNotes ?? [],
            };
          }
        } else {
          if (mode === 'exclude') {
            item.logError(
              'include-after-exclude',
              'Cannot include specific fields if specific fields are already excluded'
            );
            continue;
          }
          mode = 'include';
          const name = f.name.refString;
          if (alreadyPrivateFields.has(name)) {
            f.logError(
              'cannot-expand-access',
              `Cannot expand access of \`${name}\` from private to ${item.kind}`
            );
          }
          if (modifiers.has(name)) {
            f.logError(
              'duplicate-include',
              `Field \`${name}\` already referenced in include list`
            );
          } else {
            if (item.kind !== undefined) {
              modifiers.set(name, item.kind);
            }
            fieldsMentioned.add(name);
            if (f.note || item.note) {
              notes.set(name, {
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
              renames.push({
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
        if (f instanceof WildcardFieldReference) {
          if (f.joinPath) {
            f.logError(
              'unsupported-path-in-include',
              'Wildcards with paths are not supported in `include` blocks'
            );
          } else {
            f.logWarning(
              'wildcard-except-redundant',
              '`except: *` is implied, unless another clause uses *'
            );
          }
        } else {
          if (mode === 'include') {
            item.logError(
              'exclude-after-include',
              'Cannot exclude specific fields if specific fields are already included'
            );
          } else {
            mode = 'exclude';
            star = 'inherit';
            fieldsMentioned.add(f.refString);
          }
        }
      }
    }
  }
  const starFields: Set<string> = new Set(allFields);
  fieldsMentioned.forEach(f => starFields.delete(f));
  alreadyPrivateFields.forEach(f => starFields.delete(f));
  let fieldsToInclude: Set<string>;
  if (star !== undefined) {
    for (const field of starFields) {
      if (star !== 'inherit') {
        modifiers.set(field, star);
      }
      if (starNote) {
        notes.set(field, {...starNote});
      }
    }
  }
  if (mode !== 'exclude') {
    if (star !== undefined) {
      fieldsToInclude = allFields;
    } else {
      fieldsToInclude = fieldsMentioned;
    }
  } else {
    fieldsToInclude = starFields;
  }
  // TODO: validate that a field isn't renamed more than once
  // TODO: validate that excluded fields are not referenced by included fields
  // TODO: make renames fields work in existing references
  // TODO: make renames that would replace an excluded field don't do that
  return {fieldsToInclude, modifiers, renames, notes};
}
