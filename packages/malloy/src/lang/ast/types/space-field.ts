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
  FieldDef,
  QueryFieldDef,
  TypeDesc,
  AtomicFieldDef,
} from '../../../model/malloy_types';
import {BaseBinding, type FieldBinding} from './bindings';
import type {BaseScope} from './scope';

// TODO: Why is this called 'SpaceField'? Can I rename it something
// more aligned with the current set of Namespace/Scope terminology?
export abstract class SpaceField extends BaseBinding implements FieldBinding {
  readonly symbolKind = 'field';

  protected fieldTypeFromFieldDef(def: AtomicFieldDef): TypeDesc {
    const expressionType = def.expressionType || 'scalar';
    const ref: TypeDesc = {
      ...def,
      expressionType,
      evalSpace: 'input',
      fieldUsage:
        // Use the composite field usage in the def if it exists, otherwise, if the
        // field has an e whic is a composite field, then the composite field usage
        // should be just the name of the field.
        def.fieldUsage ??
        (def.e?.node === 'compositeField'
          ? [{path: [def.name], at: def.location}]
          : []),
    };
    return ref;
  }

  // TODO: Did I implement the correct interface, if this is supposed to exist?
  // or is this handled by fieldTypeFromFieldDef? It sounds like this class
  // doesn't have any typedesc
  getTypeDesc(): TypeDesc {
    throw new Error('Method not implemented.');
  }

  // TODO: Why does this need to exist here on this class?
  getQueryFieldDef(_scope: BaseScope): QueryFieldDef | undefined {
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
