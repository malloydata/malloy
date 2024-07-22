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
  FieldDef,
  QueryFieldDef,
  isFieldTypeDef,
  TypeDesc,
} from '../../../model/malloy_types';
import {SpaceEntry} from './space-entry';
import {FieldSpace} from './field-space';

export abstract class SpaceField extends SpaceEntry {
  readonly refType = 'field';
  haveFieldDef?: FieldDef;

  protected fieldTypeFromFieldDef(def: FieldDef): TypeDesc {
    const ref: TypeDesc = {
      dataType: def.type,
      expressionType: 'scalar',
      evalSpace: 'input',
    };
    if (isFieldTypeDef(def) && def.expressionType) {
      ref.expressionType = def.expressionType;
    }
    if (
      ref.dataType === 'sql native' &&
      def.type === 'sql native' &&
      def.rawType
    ) {
      ref.rawType = def.rawType;
    }
    return ref;
  }

  getQueryFieldDef(_fs: FieldSpace): QueryFieldDef | undefined {
    return undefined;
  }

  fieldDef(): FieldDef | undefined {
    return undefined;
  }
}
