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

import type {
  Annotation,
  QueryFieldDef,
  TypeDesc,
} from '../../../model/malloy_types';
import {TD, mkFieldDef} from '../../../model/malloy_types';
import * as TDU from '../typedesc-utils';
import type {FieldReference} from '../query-items/field-references';
import type {FieldSpace} from '../types/field-space';
import type {SpaceEntry} from '../types/space-entry';
import {SpaceField} from '../types/space-field';
import {joinedCompositeFieldUsage} from '../../../model/composite_source_utils';

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
      if (check.error) {
        this.fieldRef.logError(check.error.code, check.error.message);
      }

      // TODO investigate removing 'fieldref' as a type, as it obscures the
      //      actual type of the field and is redundant with the slightly
      //      more verbose `{ e: [{ type: 'field', path }] }`
      const path = this.fieldRef.path;
      if (check.found && check.found.refType === 'parameter') {
        const foundType = check.found.typeDesc();
        if (TD.isAtomic(foundType)) {
          this.queryFieldDef = {
            ...mkFieldDef(TDU.atomicDef(foundType), path[0]),
            e: {node: 'parameter', path},
          };
        } else {
          // not sure what to do here, if we get here
          throw new Error('impossible turtle/join parameter');
        }
      } else {
        this.queryFieldDef = {type: 'fieldref', path};
      }
      const refTo = this.referenceTo;
      if (refTo instanceof SpaceField) {
        const origFd = refTo.constructorFieldDef();
        if (origFd) {
          const notes = this.fieldRef.note;
          if (origFd.annotation || notes) {
            const annotation: Annotation = notes || {};
            if (origFd.annotation) {
              annotation.inherits = origFd.annotation;
            }
            this.queryFieldDef.annotation = annotation;
          }
        }
      }
    }
    return this.queryFieldDef;
  }

  typeDesc(): TypeDesc {
    if (this.memoTypeDesc) return this.memoTypeDesc;
    const refTo = this.referenceTo;
    if (refTo) {
      const joinPath = this.fieldRef.list.slice(0, -1).map(x => x.refString);
      const typeDesc = refTo.typeDesc();
      this.memoTypeDesc = {
        ...typeDesc,
        compositeFieldUsage: joinedCompositeFieldUsage(
          joinPath,
          typeDesc.compositeFieldUsage
        ),
      };
      return this.memoTypeDesc;
    }
    return TDU.errorT;
  }
}
