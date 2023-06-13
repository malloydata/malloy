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

import {QueryFieldDef, TypeDesc} from '../../../model/malloy_types';

import {FieldReference} from '../query-items/field-references';
import {FieldSpace} from '../types/field-space';
import {LookupResult} from '../types/lookup-result';
import {SpaceField} from '../types/space-field';

export class ReferenceField extends SpaceField {
  res: LookupResult | undefined = undefined;
  constructor(readonly fieldRef: FieldReference) {
    super();
  }

  getQueryFieldDef(fs: FieldSpace): QueryFieldDef | undefined {
    // Lookup string and generate error if it isn't defined.
    const check = this.fieldRef.getField(fs);
    if (check.error) {
      this.fieldRef.log(check.error);
    }
    this.res = check;
    return this.fieldRef.refString;
  }

  typeDesc(): TypeDesc {
    // Remember the actual type of the field that was looked up so it can be used for
    // type checking.
    if (this.res !== undefined && this.res.found) {
      return this.res.found.typeDesc();
    }
    return {dataType: 'unknown', expressionType: 'scalar', evalSpace: 'input'};
  }
}
