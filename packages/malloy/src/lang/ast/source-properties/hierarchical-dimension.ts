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

import type {AccessModifierLabel, Annotation} from '../../../model';
import {MalloyElement} from '../types/malloy-element';
import {DefinitionList} from '../types/definition-list';
import type {SourceProperty} from '../types/source-property';
import type {MakeEntry} from '../types/space-entry';
import type {DynamicSpace} from '../field-space/dynamic-space';
import {FieldReference} from '../query-items/field-references';
import {HierarchicalDimensionField} from '../field-space/hierarchical-dimension-field';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

export interface HierarchicalDimensionDef {
  name: string;
  fields: FieldReference[];
  tags: Annotation[] | undefined;
}

export class HierarchicalDimension 
  extends MalloyElement 
  implements MakeEntry, Noteable {
  elementType = 'hierarchicalDimension';
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;
  
  constructor(
    readonly name: string,
    readonly fields: FieldReference[],
    readonly accessModifier: AccessModifierLabel | undefined
  ) {
    super({fields});
  }

  makeEntry(fs: DynamicSpace): void {
    const hierarchicalField = new HierarchicalDimensionField(this);
    fs.newEntry(this.name, this, hierarchicalField);
  }

  getName(): string {
    return this.name;
  }
}

export class HierarchicalDimensions extends DefinitionList<HierarchicalDimension> {
  elementType = 'hierarchicalDimensionList';
  
  constructor(
    list: HierarchicalDimension[],
    readonly accessModifier: AccessModifierLabel | undefined
  ) {
    super(list);
  }

  get delarationNames(): string[] {
    return this.list.map(el => el.getName());
  }
}