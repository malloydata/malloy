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

import {TypeDesc} from '../../../model';
import {DynamicSpace} from '../field-space/dynamic-space';
import {MalloyElement} from './malloy-element';

export abstract class SpaceEntry {
  /**
   * Once upon a time this was called `typeDesc()` but now that is implemented here
   * as a wrapper which knows about output spaces. Individual entries should describe
   * themselves with describeType() and the typeDesc() here will call that.
   */
  abstract describeType(): TypeDesc;
  abstract refType: 'field' | 'parameter';
  outputField = false;

  typeDesc(): TypeDesc {
    const type = this.describeType();
    if (this.outputField) {
      return {
        ...type,
        evalSpace: type.evalSpace === 'constant' ? 'constant' : 'output',
      };
    }
    return type;
  }
}

export interface MakeEntry {
  makeEntry: (fs: DynamicSpace) => void;
}

export function canMakeEntry<T extends MalloyElement>(
  me: T
): me is T & MakeEntry {
  return 'makeEntry' in me;
}
