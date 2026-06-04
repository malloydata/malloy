/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef, StructDef} from '../../../model/malloy_types';
import {activeName, isPersistableSourceDef} from '../../../model/malloy_types';
import {mkSourceID} from '../../../model/source_def_utils';
import {checkPersistAnnotation} from '../../../model/persist_utils';
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
  note?: AnnotationsDef;

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
    if (this.note) {
      entry.annotations = structDef.annotations
        ? {
            ...this.note,
            inherits: structDef.annotations,
          }
        : {...this.note};
    }
    if (isPersistableSourceDef(entry)) {
      entry.sourceID = mkSourceID(this.name, this.location?.url);
      entry.persistent = checkPersistAnnotation(entry).persist;
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
        structDef.fields.find(field => activeName(field) === parameter.name)
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
