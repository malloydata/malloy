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

import type {TypeDesc, QueryFieldDef} from '../../../model/malloy_types';
import {SpaceField} from '../types/space-field';
import type {HierarchicalDimension} from '../source-properties/hierarchical-dimension';
import type {FieldSpace} from '../types/field-space';

export class HierarchicalDimensionField extends SpaceField {
  constructor(public definition: HierarchicalDimension) {
    super();
  }

  typeDesc(): TypeDesc {
    // Return a special type descriptor that identifies this as a hierarchical dimension
    return {
      type: 'hierarchical_dimension',
      name: this.definition.name,
      location: this.definition.location,
      kind: 'dimension',
      fieldPath: undefined,
      // Mark it as a special type that will trigger expansion in the compiler
      fields: this.definition.fields.map(f => f.outputName),
    } as unknown as TypeDesc;
  }

  getQueryFieldDef(fs: FieldSpace): QueryFieldDef | undefined {
    // When a hierarchical dimension is referenced in a query,
    // it should expand to multiple field references
    // This returns undefined to prevent it from being added as a single field
    // The expansion should happen at a higher level
    return undefined;
  }
}