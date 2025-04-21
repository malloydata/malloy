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

import type * as model from '../../../model/malloy_types';
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import type {DynamicSpace} from '../field-space/dynamic-space';
import type {View} from '../view-elements/view';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import {detectAndRemovePartialStages} from '../query-utils';
import {ASTViewField} from '../field-space/ast-view-field';
import type {MakeEntry} from '../types/space-entry';

export class ViewFieldDeclaration
  extends MalloyElement
  implements Noteable, MakeEntry
{
  elementType = 'view-field-declaration';
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: model.Annotation;

  constructor(
    readonly name: string,
    readonly view: View
  ) {
    super({view});
  }

  makeEntry(fs: DynamicSpace) {
    const qf = new ASTViewField(fs, this, this.name);
    fs.newEntry(this.name, this, qf);
  }

  getName(): string {
    return this.name;
  }

  getFieldDef(fs: FieldSpace): model.TurtleDef {
    const {pipeline, annotation} = this.view.pipelineComp(fs);
    const checkedPipeline = detectAndRemovePartialStages(pipeline, this);
    const def: model.TurtleDef = {
      type: 'turtle',
      name: this.name,
      pipeline: checkedPipeline,
      annotation: {...this.note, inherits: annotation},
      location: this.location,
    };
    return def;
  }
}
