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

import {
  FieldDef,
  QueryFieldDef,
  TypeDesc,
  AtomicFieldDef,
} from '../../../model/malloy_types';
import {SpaceEntry} from './space-entry';
import {FieldSpace} from './field-space';

export abstract class SpaceField extends SpaceEntry {
  readonly refType = 'field';

  protected fieldTypeFromFieldDef(def: AtomicFieldDef): TypeDesc {
    const expressionType = def.expressionType || 'scalar';
    const ref: TypeDesc = {...def, expressionType, evalSpace: 'input'};
    return ref;
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
