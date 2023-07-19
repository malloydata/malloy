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

import {StructDef} from '../../../model/malloy_types';
import {FieldListEdit} from '../source-properties/field-list-edit';
import {DynamicSpace} from './dynamic-space';
import {canMakeEntry} from '../types/space-entry';
import {MalloyElement} from '../types/malloy-element';

export class RefinedSpace extends DynamicSpace {
  /**
   * Factory for FieldSpace when there are accept/except edits
   * @param from A structdef which seeds this space
   * @param choose A accept/except edit of the "from" fields
   */
  static filteredFrom(from: StructDef, choose?: FieldListEdit): RefinedSpace {
    const edited = new RefinedSpace(from);
    if (choose) {
      const names = choose.refs.list;
      const oldMap = edited.entries();
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
      if (canMakeEntry(me)) {
        me.makeEntry(this);
      } else {
        me.log(
          `Internal error, ${me.elementType} not expected in this context`
        );
      }
    }
  }
}
