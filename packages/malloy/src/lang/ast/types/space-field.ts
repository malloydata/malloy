/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  FieldDef,
  QueryFieldDef,
  TypeDesc,
  AtomicFieldDef,
  TurtleDef,
  TurtleTypeDef,
} from '../../../model/malloy_types';
import {SpaceEntry} from './space-entry';
import type {FieldSpace} from './field-space';

export abstract class SpaceField extends SpaceEntry {
  readonly refType = 'field';

  protected fieldTypeFromFieldDef(def: AtomicFieldDef): TypeDesc {
    const expressionType = def.expressionType || 'scalar';
    const ref: TypeDesc = {
      ...def,
      expressionType,
      evalSpace: 'input',
      // Use the composite field usage in the def if it exists, otherwise, if
      // the field has an e which is a composite field, then the composite
      // field usage should be just the name of the field.
      refSummary:
        def.refSummary ??
        (def.e?.node === 'compositeField'
          ? {fieldUsage: [{path: [def.name], at: def.location}]}
          : undefined),
    };
    return ref;
  }

  protected turtleTypeFromTurtleDef(def: TurtleDef): TypeDesc {
    const turtleTypeDef: TurtleTypeDef = {
      type: 'turtle',
      pipeline: def.pipeline,
    };
    return {
      ...turtleTypeDef,
      refSummary: def.refSummary,
      // TODO these are sorta weird for a turtle...
      expressionType: 'scalar',
      evalSpace: 'constant',
    };
  }

  protected typeFromFieldDef(def: AtomicFieldDef | TurtleDef): TypeDesc {
    if (def.type === 'turtle') {
      return this.turtleTypeFromTurtleDef(def);
    } else {
      return this.fieldTypeFromFieldDef(def);
    }
  }

  getQueryFieldDef(_fs: FieldSpace): QueryFieldDef | undefined {
    return undefined;
  }

  fieldDef(): FieldDef | undefined {
    return undefined;
  }

  /**
   * Called by field reference code generation to gain access to the
   * annotation properties on the field being referenced. ColumnSpaceFields
   * will have the original field def, and will implement this method,
   * nothing else should be referencable, but if somehow one of those is
   * referenced, don't bother to compute the fieldDef.
   */
  constructorFieldDef(): FieldDef | undefined {
    return undefined;
  }
}
