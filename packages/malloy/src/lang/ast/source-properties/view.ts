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

import * as model from '../../../model/malloy_types';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {
  LegalRefinementStage,
  QueryClass,
  QueryPropertyInterface,
} from '../types/query-property-interface';
import {QueryBuilder} from '../types/query-builder';
import {DynamicSpace} from '../field-space/dynamic-space';
import {View} from '../view-elements/view';
import {Noteable, extendNoteMethod} from '../types/noteable';
import {detectAndRemovePartialStages} from '../query-utils';
import {ViewField} from '../field-space/view-field';

export class ViewDefinition
  extends MalloyElement
  implements QueryPropertyInterface, Noteable
{
  elementType = 'view-definition';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: model.Annotation;

  constructor(
    readonly name: string,
    readonly view: View
  ) {
    super({view});
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }

  makeEntry(fs: DynamicSpace) {
    const qf = new ViewField(fs, this, this.name);
    fs.newEntry(this.name, this, qf);
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
