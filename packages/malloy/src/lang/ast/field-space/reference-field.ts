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
  QueryFieldDef,
  TypeDesc,
  isAtomicFieldType,
} from '../../../model/malloy_types';

import {FieldReference} from '../query-items/field-references';
import {FieldSpace} from '../types/field-space';
import {SpaceEntry} from '../types/space-entry';
import {SpaceField} from '../types/space-field';

export class ReferenceField extends SpaceField {
  private didLookup = false;
  private memoReference?: SpaceEntry;
  private memoTypeDesc?: TypeDesc;
  private queryFieldDef?: QueryFieldDef;
  constructor(
    readonly fieldRef: FieldReference,
    readonly inFS: FieldSpace
  ) {
    super();
  }

  get referenceTo(): SpaceEntry | undefined {
    if (!this.didLookup) {
      this.memoReference = this.inFS.lookup(this.fieldRef.list).found;
      this.didLookup = true;
    }
    return this.memoReference;
  }

  getQueryFieldDef(fs: FieldSpace): QueryFieldDef | undefined {
    if (!this.queryFieldDef) {
      const check = this.fieldRef.getField(fs);
      if (check.error !== undefined) {
        this.fieldRef.log(check.error);
        return undefined;
      }
      const path = this.fieldRef.path;
      const typeDesc = check.found.typeDesc();
      const type = typeDesc.dataType;
      const expressionType = typeDesc.expressionType;
      if (!isAtomicFieldType(type)) {
        return undefined;
      }

      const queryFieldDef: QueryFieldDef =
        check.found.refType === 'parameter'
          ? {
              type,
              name: path[0],
              e: {node: 'parameter', path},
            }
          : {
              type,
              name: this.fieldRef.nameString,
              expressionType,
              e: {node: 'field', path},
            };
      this.queryFieldDef = queryFieldDef;

      const refTo = this.referenceTo;
      if (refTo instanceof SpaceField && refTo.haveFieldDef) {
        const origFd = refTo.haveFieldDef;
        const notes = this.fieldRef.note;
        if (origFd.annotation || notes) {
          const annotation: Annotation = notes || {};
          if (origFd.annotation) {
            annotation.inherits = origFd.annotation;
          }
          this.queryFieldDef.annotation = annotation;
        }
        if (origFd.location && this.queryFieldDef.type !== 'fieldref') {
          this.queryFieldDef.location = origFd.location;
        }
      }
    }
    return this.queryFieldDef;
  }

  typeDesc(): TypeDesc {
    if (this.memoTypeDesc) return this.memoTypeDesc;
    const refTo = this.referenceTo;
    if (refTo) {
      this.memoTypeDesc = refTo.typeDesc();
      return this.memoTypeDesc;
    }
    return {dataType: 'error', expressionType: 'scalar', evalSpace: 'input'};
  }
}
