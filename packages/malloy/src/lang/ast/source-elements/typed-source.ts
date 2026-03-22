/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AtomicFieldDef,
  FieldDef,
  NonDefaultAccessModifierLabel,
  SourceDef,
} from '../../../model/malloy_types';
import {TD, isStructShapeDef, mkFieldDef} from '../../../model/malloy_types';
import {Source} from './source';
import type {ParameterSpace} from '../field-space/parameter-space';
import type {ModelEntryReference} from '../types/malloy-element';

export const STRUCT_SHAPE_HIDDEN_ACCESS: NonDefaultAccessModifierLabel =
  'internal';

/**
 * With each field, keep the shape reference it came from, for error reporting
 */
class Shape extends Map<
  string,
  {field: AtomicFieldDef; fromShape: ModelEntryReference}
> {}

/**
 * A Source wrapped with struct shape type constraints via the `::` operator.
 * Resolves and merges shapes (validating no conflicts), then:
 * - virtual sources: shape fields not in the source are added
 * - all other sources: shape fields not in the source are an error
 * - in both cases: source fields not in any shape are marked
 *   with STRUCT_SHAPE_HIDDEN_ACCESS
 *
 * e.g. `source::MyStruct` or `source::<A, B>`
 */
export class TypedSource extends Source {
  elementType = 'typedSource';

  constructor(
    readonly innerSource: Source,
    readonly structShapes: ModelEntryReference[]
  ) {
    super({innerSource});
    this.has({structShapes});
  }

  getSourceDef(parameterSpace: ParameterSpace | undefined): SourceDef {
    const sourceDef = this.innerSource.getSourceDef(parameterSpace);

    // Merge structs, while validating no field conflicts
    const [outputShape, ...remainingShapes] = this.nextShape();
    if (outputShape === undefined) {
      return sourceDef;
    }
    for (const mergeShape of remainingShapes) {
      for (const [name, {field, fromShape}] of mergeShape) {
        const existing = outputShape.get(name);
        if (existing && !TD.eq(field, existing.field)) {
          fromShape.logError(
            'struct-shape-field-conflict',
            `Field '${name}' has conflicting types in structs '${existing.fromShape.name}' and '${fromShape.name}'`
          );
        } else {
          outputShape.set(name, {field, fromShape});
        }
      }
    }

    const isVirtual = sourceDef.type === 'virtual';
    const sourceFieldNames = new Set(sourceDef.fields.map(f => f.as ?? f.name));
    const fieldsToAdd: FieldDef[] = [];

    // Validate/Enforce that this source matches the shape
    for (const [name, {field, fromShape}] of outputShape) {
      if (!sourceFieldNames.has(name)) {
        if (isVirtual) {
          fieldsToAdd.push(field);
        } else {
          fromShape.logError(
            'struct-shape-field-missing',
            `Source is missing field '${field.name}' required by struct '${fromShape.name}'`
          );
        }
      }
    }

    // Source fields not in any shape: mark as hidden
    const resultFields = sourceDef.fields.map(f => {
      const name = f.as ?? f.name;
      if (outputShape.has(name)) {
        return f;
      }
      return {...f, accessModifier: STRUCT_SHAPE_HIDDEN_ACCESS};
    });

    return {
      ...sourceDef,
      fields: [...resultFields, ...fieldsToAdd],
    };
  }

  private *nextShape(): Generator<Shape> {
    for (const ref of this.structShapes) {
      const next = new Shape();
      const entry = this.modelEntry(ref);
      if (entry === undefined) {
        ref.logError('struct-not-found', `Struct '${ref.name}' is not defined`);
        continue;
      }
      if (!isStructShapeDef(entry.entry)) {
        ref.logError('not-a-struct', `'${ref.name}' is not a struct`);
        continue;
      }

      for (const sf of entry.entry.fields) {
        next.set(sf.name, {
          field: mkFieldDef(sf.typeDef, sf.name),
          fromShape: ref,
        });
      }
      yield next;
    }
  }
}
