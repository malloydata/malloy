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

import {QueryFieldDef, TurtleDef} from '../../../model/malloy_types';
import {ViewDefinition} from '../source-properties/view';
import {FieldSpace} from '../types/field-space';
import {QueryField} from './query-space-field';

// TODO naming: There's two subclasses of QueryField: ViewField and QueryFieldStruct
// All three names should be changed. Maybe:
// QueryField -> ViewField
// ViewField -> ASTViewField
// QueryFieldStruct -> IRViewField

export class ViewField extends QueryField {
  constructor(
    fs: FieldSpace,
    readonly view: ViewDefinition,
    protected name: string
  ) {
    super(fs);
  }

  getQueryFieldDef(fs: FieldSpace): QueryFieldDef {
    return this.view.getFieldDef(fs);
  }

  fieldDef(): TurtleDef {
    return this.view.getFieldDef(this.inSpace);
  }
}
