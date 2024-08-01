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
  IndexSegment,
  PipeSegment,
  IndexFieldDef,
  isAtomicFieldType,
  expressionIsScalar,
} from '../../../model/malloy_types';
import {
  FieldReference,
  IndexFieldReference,
  WildcardFieldReference,
} from '../query-items/field-references';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {SpaceEntry} from '../types/space-entry';
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
        indexField.log('Internal error, not expected in index query');
      }
    }
  }

  getPipeSegment(refineIndex?: PipeSegment): IndexSegment {
    if (refineIndex) {
      this.log('index query operations cannot be refined');
      return {type: 'index', indexFields: []};
    }
    const indexFields: IndexFieldDef[] = [];
    for (const [name, field] of this.entries()) {
      if (field instanceof SpaceField) {
        const wildPath = this.expandedWild[name];
        if (wildPath) {
          indexFields.push({type: 'fieldref', path: wildPath});
          continue;
        }
        if (field instanceof ReferenceField) {
          // attempt to cause a type check
          const fieldRef = field.fieldRef;
          const check = fieldRef.getField(this.exprSpace);
          if (check.error) {
            fieldRef.log(check.error);
          } else {
            indexFields.push(fieldRef.refToField);
          }
        }
      }
    }
    return {type: 'index', indexFields};
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
            pathPart.log(
              `Field '${part}' does not contain rows and cannot be expanded with '*'`
            );
            return;
          }
        } else {
          pathPart.log(`No such field as '${part}'`);
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
        const conflict = this.expandedWild[indexName]?.join('.');
        wild.log(
          `Cannot expand '${name}' in '${
            wild.refString
          }' because a field with that name already exists${
            conflict ? ` (conflicts with ${conflict})` : ''
          }`
        );
      } else {
        const eType = entry.typeDesc();
        if (
          isAtomicFieldType(eType.dataType) &&
          expressionIsScalar(eType.expressionType) &&
          (dialect === undefined || !dialect.ignoreInProject(name))
        ) {
          expandEntries.push({name: indexName, entry});
          this.expandedWild[indexName] = joinPath.concat(name);
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
