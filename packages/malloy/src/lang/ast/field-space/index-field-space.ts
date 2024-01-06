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
  IndexSegment,
  PipeSegment,
  IndexFieldDef,
} from '../../../model/malloy_types';
import {
  FieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import {MalloyElement} from '../types/malloy-element';
import {SpaceField} from '../types/space-field';
import {QueryOperationSpace} from './query-spaces';

export class IndexFieldSpace extends QueryOperationSpace {
  readonly segmentType = 'index';

  pushFields(...defs: MalloyElement[]) {
    for (const indexField of defs) {
      if (indexField instanceof FieldReference) {
        super.pushFields(indexField);
      } else if (indexField instanceof WildcardFieldReference) {
        this.addWild(indexField);
      } else {
        indexField.log('Internal error, not expected in index query');
      }
    }
  }

  // mtoy TODO whic is the refineIndex unused
  getPipeSegment(_refineIndex?: PipeSegment): IndexSegment {
    const indexFields: IndexFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const wildPath = this.expandedWild[name];
        if (wildPath) {
          indexFields.push({type: 'fieldref', path: wildPath});
          continue;
        }
        if (field instanceof FieldReference) {
          indexFields.push(field.refToField);
        }
        // see pushFields above, this is all there is
      }
    }
    return {type: 'index', indexFields};
  }

  addRefineFromFields(_refineThis: never) {
    throw new Error('Refine the index');
  }
}
