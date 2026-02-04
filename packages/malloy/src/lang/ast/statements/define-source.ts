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

import type {Annotation, StructDef} from '../../../model/malloy_types';
import {isPersistableSourceDef} from '../../../model/malloy_types';
import {mkSourceID} from '../../../model/source_def_utils';
import {ErrorFactory} from '../error-factory';
import type {HasParameter} from '../parameters/has-parameter';
import type {DocStatement, Document} from '../types/malloy-element';
import {MalloyElement, DocStatementList} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import type {SourceQueryElement} from '../source-query-elements/source-query-element';
import {getPartitionCompositeDesc} from '../../composite-source-utils';

export class DefineSource
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'defineSource';
  constructor(
    readonly name: string,
    readonly sourceExpr: SourceQueryElement | undefined,
    readonly exported: boolean,
    readonly parameters?: HasParameter[] | undefined
  ) {
    super();
    if (sourceExpr) {
      this.has({sourceExpr});
    }
    if (parameters) {
      this.has({parameters});
    }
  }
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  execute(doc: Document): void {
    if (doc.modelEntry(this.name)) {
      this.logError(
        'source-definition-name-conflict',
        `Cannot redefine '${this.name}'`
      );
      return;
    }
    const theSource = this.sourceExpr?.getSource();
    if (theSource === undefined) {
      return;
    }
    const parameters = this.deduplicatedParameters();
    const structDef = theSource.withParameters(undefined, this.parameters);
    this.validateParameterShadowing(parameters, structDef);
    if (ErrorFactory.didCreate(structDef)) {
      return;
    }
    const entry: StructDef = {
      ...structDef,
      as: this.name,
      location: this.location,
    };
    if (isPersistableSourceDef(entry)) {
      entry.sourceID = mkSourceID(this.name, this.location?.url);
    }
    if (this.note) {
      entry.annotation = structDef.annotation
        ? {...this.note, inherits: structDef.annotation}
        : this.note;
    }
    entry.partitionComposite =
      getPartitionCompositeDesc(
        this.note,
        structDef,
        this.sourceExpr ?? this
      ) ?? structDef.partitionComposite;
    doc.setEntry(this.name, {entry, exported: this.exported});
  }

  private deduplicatedParameters(): HasParameter[] {
    if (this.parameters === undefined) return [];
    const exists = {};
    const out: HasParameter[] = [];
    for (const parameter of this.parameters) {
      if (parameter.name in exists) {
        parameter.logError(
          'parameter-name-conflict',
          `Cannot redefine parameter \`${parameter.name}\``
        );
      }
      exists[parameter.name] = true;
      out.push(parameter);
    }
    return out;
  }

  private validateParameterShadowing(
    parameters: HasParameter[],
    structDef: StructDef
  ) {
    for (const parameter of parameters) {
      if (
        structDef.fields.find(
          field => (field.as ?? field.name) === parameter.name
        )
      ) {
        parameter.logError(
          'parameter-shadowing-field',
          `Illegal shadowing of field \`${parameter.name}\` by parameter with the same name`
        );
      }
    }
  }
}

export class DefineSourceList extends DocStatementList {
  elementType = 'defineSources';
  constructor(sourceList: DefineSource[]) {
    super(sourceList);
  }
}
