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

import * as model from '../../../model/malloy_types';
import {FieldDeclaration} from '../query-items/field-declaration';
import {FieldSpace} from '../types/field-space';
import {SpaceField} from '../types/space-field';
import {TypeDesc} from '../../../model/malloy_types';

export class FieldDefinitionValue extends SpaceField {
  fieldName: string;
  constructor(readonly space: FieldSpace, readonly exprDef: FieldDeclaration) {
    super();
    this.fieldName = exprDef.defineName;
  }

  get name(): string {
    return this.fieldName;
  }

  // A source will call this when it defines the field
  fieldDef(): model.FieldDef {
    if (!this.haveFieldDef) {
      this.haveFieldDef = this.exprDef.fieldDef(this.space, this.name);
    }
    return this.haveFieldDef;
  }

  // A query will call this when it defined the field
  private qfd?: model.FieldTypeDef;
  getQueryFieldDef(fs: FieldSpace): model.QueryFieldDef {
    if (!this.qfd) {
      const def = this.exprDef.queryFieldDef(fs, this.name);
      this.qfd = def;
    }
    return this.qfd;
  }

  // If this is called before the expression has been evaluated, we don't
  // really know what type we have. However since we have the FieldSpace,
  // we can compile the expression to find out, this might result in
  // some expressions being compiled twice.
  typeDesc(): TypeDesc {
    const typeFrom = this.qfd || this.fieldDef();
    return this.fieldTypeFromFieldDef(typeFrom);
  }
}
