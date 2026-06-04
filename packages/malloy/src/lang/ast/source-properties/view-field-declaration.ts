/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
  note?: model.AnnotationsDef;

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
    const {pipeline, annotations} = this.view.pipelineComp(fs);
    const checkedPipeline = detectAndRemovePartialStages(pipeline, this);
    const def: model.TurtleDef = {
      type: 'turtle',
      name: this.name,
      pipeline: checkedPipeline,
      annotations: {
        ...this.note,
        inherits: annotations,
      },
      location: this.location,
    };
    return def;
  }
}
