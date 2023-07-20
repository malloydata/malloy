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

import {Annotation, FieldDef, TypeDesc} from '../../../model/malloy_types';
import {DynamicSpace} from '../field-space/dynamic-space';
import {ReferenceField} from '../field-space/reference-field';
import {DefinitionList} from '../types/definition-list';

import {FieldName, FieldSpace} from '../types/field-space';
import {LookupResult} from '../types/lookup-result';
import {ListOf, MalloyElement} from '../types/malloy-element';
import {Noteable, extendNoteMethod} from '../types/noteable';
import {MakeEntry} from '../types/space-entry';

import {
  typecheckAggregate,
  typecheckCalculate,
  typecheckDeclare,
  typecheckDimension,
  typecheckGroupBy,
  typecheckIndex,
  typecheckMeasure,
  typecheckProject,
} from './typecheck_utils';

export type FieldReferenceConstructor = new (
  names: FieldName[]
) => FieldReference;

export abstract class FieldReference
  extends ListOf<FieldName>
  implements Noteable, MakeEntry
{
  readonly isNoteableObj = true;
  note?: Annotation;
  extendNote = extendNoteMethod;

  constructor(names: FieldName[]) {
    super(names);
  }

  makeEntry(fs: DynamicSpace) {
    const refName = this.outputName;
    if (fs.entry(refName)) {
      this.log(`Output already has a field named '${refName}'`);
    } else {
      fs.newEntry(this.refString, this, new ReferenceField(this));
    }
  }

  get refString(): string {
    return this.list.map(n => n.refString).join('.');
  }

  get outputName(): string {
    const last = this.list[this.list.length - 1];
    return last.refString;
  }

  get sourceString(): string | undefined {
    if (this.list.length > 1) {
      return this.list
        .slice(0, -1)
        .map(n => n.refString)
        .join('.');
    }
    return undefined;
  }

  get nameString(): string {
    return this.list[this.list.length - 1].refString;
  }

  abstract typecheck(type: TypeDesc);

  getField(fs: FieldSpace): LookupResult {
    const result = fs.lookup(this.list);

    if (result.found) {
      const actualType = result.found.typeDesc();
      this.typecheck(actualType);
    }

    return result;
  }
}

export class AcceptExceptFieldReference extends FieldReference {
  elementType = 'acceptExceptFieldReference';
  // Nothing to typecheck here
  typecheck() {
    return;
  }
}

export class ExpressionFieldReference extends FieldReference {
  elementType = 'expressionFieldReference';
  // We assume that the outer expression will typecheck this
  typecheck() {
    return;
  }
}

export class CalculateFieldReference extends FieldReference {
  elementType = 'calculateFieldReference';
  typecheck(type: TypeDesc) {
    typecheckCalculate(type, this);
  }
}

export class IndexFieldReference extends FieldReference {
  elementType = 'indexFieldReference';
  typecheck(type: TypeDesc) {
    typecheckIndex(type, this);
  }
}

export class AggregateFieldReference extends FieldReference {
  elementType = 'aggregateFieldReference';
  typecheck(type: TypeDesc) {
    typecheckAggregate(type, this);
  }
}

export class GroupByFieldReference extends FieldReference {
  elementType = 'groupByFieldReference';
  typecheck(type: TypeDesc) {
    typecheckGroupBy(type, this);
  }
}

export class ProjectFieldReference extends FieldReference {
  elementType = 'projectFieldReference';
  typecheck(type: TypeDesc) {
    typecheckProject(type, this);
  }
}

export class DeclareFieldReference extends FieldReference {
  elementType = 'declareFieldReference';
  typecheck(type: TypeDesc) {
    typecheckDeclare(type, this);
  }
}

export class MeasureFieldReference extends FieldReference {
  elementType = 'measureFieldReference';
  typecheck(type: TypeDesc) {
    typecheckMeasure(type, this);
  }
}

export class DimensionFieldReference extends FieldReference {
  elementType = 'dimensionFieldReference';
  typecheck(type: TypeDesc) {
    typecheckDimension(type, this);
  }
}

export class WildcardFieldReference extends MalloyElement implements Noteable {
  elementType = 'wildcardFieldReference';
  note?: Annotation;
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  constructor(
    readonly joinPath: FieldReference | undefined,
    readonly star: '*' | '**'
  ) {
    super();
    this.has({joinPath: joinPath});
  }

  getFieldDef(): FieldDef {
    throw this.internalError('fielddef request from wildcard reference');
  }

  get refString(): string {
    return this.joinPath
      ? `${this.joinPath.refString}.${this.star}`
      : this.star;
  }
}

export type FieldReferenceElement = FieldReference | WildcardFieldReference;

export class FieldReferences extends DefinitionList<FieldReferenceElement> {
  elementType = 'fieldReferenceList';
  constructor(members: FieldReferenceElement[]) {
    super(members);
  }
}
