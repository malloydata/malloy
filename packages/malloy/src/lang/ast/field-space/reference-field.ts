/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AnnotationsDef,
  FieldUsageEntry,
  QueryFieldDef,
  TypeDesc,
} from '../../../model/malloy_types';
import {TD, mkFieldDef} from '../../../model/malloy_types';
import * as TDU from '../typedesc-utils';
import type {FieldReference} from '../query-items/field-references';
import type {FieldSpace} from '../types/field-space';
import type {SpaceEntry} from '../types/space-entry';
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
            e: {node: 'parameter', path, at: this.fieldRef.location},
          };
        } else {
          // not sure what to do here, if we get here
          throw new Error('impossible turtle/join parameter');
        }
      } else {
        this.queryFieldDef = {
          type: 'fieldref',
          path,
          at: this.fieldRef.location,
          drillExpression: {
            kind: 'field_reference',
            name: path[path.length - 1],
            path: path.slice(0, -1),
          },
        };
      }
      const refTo = this.referenceTo;
      if (refTo instanceof SpaceField) {
        const origFd = refTo.constructorFieldDef();
        if (origFd) {
          const notes = this.fieldRef.note;
          if (origFd.annotations || notes) {
            const annotations: AnnotationsDef = {
              ...(notes ?? {}),
            };
            if (origFd.annotations) {
              annotations.inherits = origFd.annotations;
            }
            this.queryFieldDef.annotations = annotations;
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
      const usage: FieldUsageEntry = {
        path: this.fieldRef.path,
        at: this.fieldRef.location,
      };
      this.memoTypeDesc = {
        ...typeDesc,
        refSummary: {fieldUsage: [usage]},
        requiresGroupBy: typeDesc.requiresGroupBy?.map(gb => ({
          ...gb,
          path: [...joinPath, ...gb.path],
          fieldUsage: usage,
        })),
      };
      return this.memoTypeDesc;
    }
    return TDU.errorT;
  }
}
