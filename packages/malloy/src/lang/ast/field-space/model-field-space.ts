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

import {Dialect} from '../../../dialect';
import {ModelDef, StructDef} from '../../../model';
import {FieldName, FieldSpace} from '../types/field-space';
import {LookupResult} from '../types/lookup-result';

export class ModelSpace implements FieldSpace {
  readonly type = 'fieldSpace';

  constructor(readonly modelDef: ModelDef) {}

  structDef(): StructDef {
    throw new Error('Model space cannot generate a struct Def');
  }

  emptyStructDef(): StructDef {
    throw new Error('Model space cannot generate a struct Def');
  }

  lookup(symbol: FieldName[]): LookupResult {
    const firstPart = symbol[0];
    if (firstPart === undefined) {
      return {error: 'not found!', found: undefined};
    }
    return {error: 'not found!', found: undefined};
  }

  dialectObj(): Dialect | undefined {
    return undefined;
  }

  whenComplete(_step: () => void): void {
    // Do nothing
  }
}
