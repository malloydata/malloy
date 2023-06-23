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
  Annotation,
  FieldAtomicDef,
  QueryFieldDef,
  TypeDesc,
  isAtomicFieldType,
  isFilteredAliasedName,
} from '../../../model/malloy_types';

import {FieldReference} from '../query-items/field-references';
import {FieldSpace} from '../types/field-space';
import {SpaceEntry} from '../types/space-entry';
import {SpaceField} from '../types/space-field';

export class ReferenceField extends SpaceField {
  res?: SpaceEntry;
  private queryFieldDef?: QueryFieldDef;
  constructor(readonly fieldRef: FieldReference) {
    super();
  }

  getQueryFieldDef(fs: FieldSpace): QueryFieldDef | undefined {
    if (!this.queryFieldDef) {
      const check = this.fieldRef.getField(fs);
      if (check.error) {
        this.fieldRef.log(check.error);
      }
      this.res = check.found;
      this.queryFieldDef = this.maybeAnnotate();
    }
    return this.queryFieldDef;
  }

  typeDesc(): TypeDesc {
    // Remember the actual type of the field that was looked up so it can be used for
    // type checking.
    if (this.res !== undefined) {
      return this.res.typeDesc();
    }
    return {dataType: 'error', expressionType: 'scalar', evalSpace: 'input'};
  }

  /**
   * If the referenced field has any annotations, replace the reference
   * with something which can hold an annotation
   */
  maybeAnnotate(): QueryFieldDef {
    const path = this.fieldRef.refString;
    if (
      this.res instanceof SpaceField &&
      this.res.haveFieldDef &&
      typeof this.res.haveFieldDef !== 'string'
    ) {
      const origFd = this.res.haveFieldDef;
      if (isFilteredAliasedName(origFd)) {
        return origFd;
      }
      const notes = this.fieldRef.note;
      if (origFd.annotation || notes) {
        const annotation: Annotation = notes || {};
        if (origFd.annotation) {
          annotation.inherits = origFd.annotation;
        }
        if (this.fieldRef.list.length > 1) {
          // This is a field inside a join or a record, create an expression
          // and annotate the expression.
          if (isAtomicFieldType(origFd.type)) {
            const newField: FieldAtomicDef = {
              name: this.fieldRef.list[-1].refString,
              type: origFd.type,
              e: [{type: 'field', path}],
              annotation,
            };
            return newField;
          }
          // maybe ok, this likely is some field which cannot be referenced
          // in a query and will error, so there would be nothing to annotate
          return path;
        }
        return {...origFd, annotation};
      }
    }
    return path;
  }
}
