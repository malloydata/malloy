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
  emptyFieldUsage,
  mergeFieldUsage,
} from '../../../model/composite_source_utils';
import type {
  IndexSegment,
  PipeSegment,
  IndexFieldDef,
  FieldUsage,
  SourceDef,
} from '../../../model/malloy_types';
import {expressionIsScalar, TD} from '../../../model/malloy_types';
import {ErrorFactory} from '../error-factory';
import {
  FieldReference,
  IndexFieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import type {FieldSpace} from '../types/field-space';
import type {MalloyElement} from '../types/malloy-element';
import type {SpaceEntry} from '../types/space-entry';
import {SpaceField} from '../types/space-field';
import {QueryOperationSpace} from './query-spaces';
import {ReferenceField} from './reference-field';
import {StructSpaceField} from './static-space';

export class IndexFieldSpace extends QueryOperationSpace {
  readonly segmentType = 'index';

  pushFields(...defs: MalloyElement[]) {
    for (const indexField of defs) {
      if (indexField instanceof FieldReference) {
        super.pushFields(indexField);
      } else if (indexField instanceof WildcardFieldReference) {
        this.addWild(indexField);
      } else {
        indexField.logError(
          'invalid-field-in-index-query',
          'Internal error, not expected in index query'
        );
      }
    }
  }

  structDef(): SourceDef {
    const connection = this.inputSpace().connectionName();
    return {
      type: 'query_result',
      name: 'result',
      dialect: this.dialectName(),
      fields: [
        {type: 'string', name: 'fieldName'},
        {type: 'string', name: 'fieldPath'},
        {type: 'string', name: 'fieldValue'},
        {type: 'string', name: 'fieldType'},
        {type: 'number', name: 'weight', numberType: 'integer'},
      ],
      connection,
    };
  }

  getPipeSegment(refineIndex?: PipeSegment): IndexSegment {
    if (refineIndex) {
      this.logError(
        'refinement-of-index-segment',
        'index query operations cannot be refined'
      );
      return ErrorFactory.indexSegment;
    }
    let fieldUsage = emptyFieldUsage();
    const indexFields: IndexFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        let nextFieldUsage: FieldUsage[] | undefined = undefined;
        const wild = this.expandedWild[name];
        if (wild) {
          indexFields.push({type: 'fieldref', path: wild.path, at: wild.at});
          nextFieldUsage = wild.entry.typeDesc().fieldUsage;
        } else if (field instanceof ReferenceField) {
          // attempt to cause a type check
          const fieldRef = field.fieldRef;
          const check = fieldRef.getField(this.exprSpace);
          if (check.error) {
            fieldRef.logError(check.error.code, check.error.message);
          } else {
            indexFields.push(fieldRef.refToField);
            nextFieldUsage = check.found.typeDesc().fieldUsage;
          }
        }
        fieldUsage = mergeFieldUsage(fieldUsage, nextFieldUsage) ?? [];
      }
    }
    this._fieldUsage = fieldUsage;
    const outputStruct = this.structDef();
    return {type: 'index', indexFields, outputStruct};
  }

  addRefineFromFields(_refineThis: never) {}

  protected addWild(wild: WildcardFieldReference): void {
    let current: FieldSpace = this.exprSpace;
    const joinPath: string[] = [];
    if (wild.joinPath) {
      // walk path to determine namespace for *
      for (const pathPart of wild.joinPath.list) {
        const part = pathPart.refString;
        joinPath.push(part);

        const ent = current.entry(part);
        if (ent) {
          if (ent instanceof StructSpaceField) {
            current = ent.fieldSpace;
          } else {
            pathPart.logError(
              'invalid-wildcard-source',
              `Field '${part}' does not contain rows and cannot be expanded with '*'`
            );
            return;
          }
        } else {
          pathPart.logError(
            'wildcard-source-not-found',
            `No such field as '${part}'`
          );
          return;
        }
      }
    }
    const dialect = this.dialectObj();
    const expandEntries: {name: string; entry: SpaceEntry}[] = [];
    for (const [name, entry] of current.entries()) {
      if (wild.except.has(name)) {
        continue;
      }
      if (entry.refType === 'parameter') {
        continue;
      }
      const indexName = IndexFieldReference.indexOutputName([
        ...joinPath,
        name,
      ]);
      if (this.entry(indexName)) {
        const conflict = this.expandedWild[indexName].path?.join('.');
        wild.logError(
          'name-conflict-in-wildcard-expansion',
          `Cannot expand '${name}' in '${
            wild.refString
          }' because a field with that name already exists${
            conflict ? ` (conflicts with ${conflict})` : ''
          }`
        );
      } else {
        const eTypeDesc = entry.typeDesc();
        // Don't index arrays and records
        if (
          TD.isBasicAtomic(eTypeDesc) &&
          expressionIsScalar(eTypeDesc.expressionType) &&
          (dialect === undefined || !dialect.ignoreInProject(name))
        ) {
          expandEntries.push({name: indexName, entry});
          this.expandedWild[indexName] = {
            path: joinPath.concat(name),
            entry,
            at: wild.location,
          };
        }
      }
    }
    // There were tests which expected these to be sorted, and that seems reasonable
    for (const x of expandEntries.sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      this.setEntry(x.name, x.entry);
    }
  }
}
