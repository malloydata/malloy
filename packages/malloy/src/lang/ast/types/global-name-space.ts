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

import {getDialectFunction} from '../../../dialect';
import {ModelEntry} from './model-entry';
import {NameSpace} from './name-space';

/**
 * We may want to remove this in the future...
 *
 * This is a global namespace which exists in the root of all Documents
 * and includes SQL function definitions.
 */
export class GlobalNameSpace implements NameSpace {
  getEntry(name: string): ModelEntry | undefined {
    // TODO cache this or precompute this so we're not comparing/merging dialect
    // overloads on every usage
    const func = getDialectFunction(name);
    if (func === undefined) {
      return undefined;
    }
    return {
      entry: func,
      exported: false,
    };
  }

  setEntry(_name: string, _value: ModelEntry, _exported: boolean): void {
    throw new Error('The global namespace is immutable!');
  }
}
