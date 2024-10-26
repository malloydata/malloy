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

import {isSourceDef, JoinFieldDef, TypeDesc} from '../../../model/malloy_types';
import * as TDU from '../typedesc-utils';
import {FieldSpace} from '../types/field-space';
import {JoinPathElement} from '../types/lookup-result';
import {SpaceField} from '../types/space-field';

export abstract class StructSpaceFieldBase extends SpaceField {
  constructor(protected structDef: JoinFieldDef) {
    super();
  }

  abstract get fieldSpace(): FieldSpace;

  fieldDef(): JoinFieldDef {
    return this.structDef;
  }

  get joinPathElement(): JoinPathElement {
    return {
      name: this.structDef.as || this.structDef.name,
      joinType: this.structDef.join,
      joinElementType: this.structDef.type,
    };
  }

  typeDesc(): TypeDesc {
    if (isSourceDef(this.structDef)) {
      return {
        type: this.structDef.type,
        evalSpace: 'input',
        expressionType: 'scalar',
      };
    }
    return {
      ...TDU.atomicDef(this.structDef),
      evalSpace: 'input',
      expressionType: 'scalar',
    };
  }
}
