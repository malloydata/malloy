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
  Annotation,
  Expr,
  isJoinOn,
  StructDef,
} from '../../../model/malloy_types';
import {DynamicSpace} from '../field-space/dynamic-space';
import {JoinSpaceField} from '../field-space/join-space-field';
import {DefinitionList} from '../types/definition-list';
import {QueryBuilder} from '../types/query-builder';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement, ModelEntryReference} from '../types/malloy-element';
import {extendNoteMethod, Noteable} from '../types/noteable';
import {
  LegalRefinementStage,
  QueryPropertyInterface,
} from '../types/query-property-interface';
import {MakeEntry} from '../types/space-entry';
import {SourceQueryElement} from '../source-query-elements/source-query-element';
import {ErrorFactory} from '../error-factory';
import {ParameterSpace} from '../field-space/parameter-space';

export abstract class Join
  extends MalloyElement
  implements Noteable, MakeEntry
{
  abstract name: ModelEntryReference;
  abstract structDef(parameterSpace: ParameterSpace): StructDef;
  abstract fixupJoinOn(outer: FieldSpace, inStruct: StructDef): void;
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  abstract sourceExpr: SourceQueryElement;
  note?: Annotation;

  makeEntry(fs: DynamicSpace) {
    fs.newEntry(
      this.name.refString,
      this,
      new JoinSpaceField(fs.parameterSpace(), this)
    );
  }

  protected getStructDefFromExpr(parameterSpace: ParameterSpace) {
    const source = this.sourceExpr.getSource();
    if (!source) {
      this.sourceExpr.sqLog(
        'invalid-join-source',
        'Cannot create a source to join from'
      );
      return ErrorFactory.structDef;
    }
    return source.structDef(parameterSpace);
  }
}

export class KeyJoin extends Join {
  elementType = 'joinOnKey';
  constructor(
    readonly name: ModelEntryReference,
    readonly sourceExpr: SourceQueryElement,
    readonly keyExpr: ExpressionDef
  ) {
    super({name, sourceExpr, keyExpr});
  }

  structDef(parameterSpace: ParameterSpace): StructDef {
    const sourceDef = this.getStructDefFromExpr(parameterSpace);
    const joinStruct: StructDef = {
      ...sourceDef,
      structRelationship: {
        type: 'one',
        matrixOperation: 'left',
        onExpression: {node: 'error', message: "('join fixup'='not done yet')"},
      },
      location: this.location,
    };
    if (sourceDef.structSource.type === 'query') {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.refString;
    } else {
      joinStruct.as = this.name.refString;
    }

    if (this.note) {
      joinStruct.annotation = this.note;
    }
    this.document()?.rememberToAddModelAnnotations(joinStruct);
    return joinStruct;
  }

  fixupJoinOn(outer: FieldSpace, inStruct: StructDef): void {
    const exprX = this.keyExpr.getExpression(outer);
    if (inStruct.primaryKey) {
      const pkey = inStruct.fields.find(
        f => (f.as || f.name) === inStruct.primaryKey
      );
      if (pkey) {
        if (pkey.type === exprX.dataType) {
          inStruct.structRelationship = {
            type: 'one',
            matrixOperation: 'left',
            onExpression: {
              node: '=',
              kids: {
                left: {
                  node: 'field',
                  path: [this.name.refString, inStruct.primaryKey],
                },
                right: exprX.value,
              },
            },
          };
          return;
        } else {
          this.logError(
            'join-on-primary-key-type-mismatch',
            `join_one: with type mismatch with primary key: ${exprX.dataType}/${pkey.type}`
          );
        }
      } else {
        this.logError(
          'join-primary-key-not-found',
          `join_one: Primary key '${pkey}' not found in source`
        );
      }
    } else {
      this.logError(
        'join-with-without-primary-key',
        'join_one: Cannot use with unless source has a primary key'
      );
    }
  }
}

type ExpressionJoinType = 'many' | 'one' | 'cross';
export type MatrixOperation = 'left' | 'inner' | 'right' | 'full';
export class ExpressionJoin extends Join {
  elementType = 'joinOnExpr';
  joinType: ExpressionJoinType = 'one';
  matrixOperation: MatrixOperation = 'left';
  private expr?: ExpressionDef;
  constructor(
    readonly name: ModelEntryReference,
    readonly sourceExpr: SourceQueryElement
  ) {
    super({name, sourceExpr});
  }

  set joinOn(joinExpr: ExpressionDef | undefined) {
    this.expr = joinExpr;
    this.has({on: joinExpr});
  }

  get joinOn(): ExpressionDef | undefined {
    return this.expr;
  }

  fixupJoinOn(outer: FieldSpace, inStruct: StructDef): Expr | undefined {
    if (this.expr === undefined) {
      return;
    }
    const exprX = this.expr.getExpression(outer);
    if (exprX.dataType !== 'boolean') {
      this.logError(
        'non-boolean-join-on',
        'join conditions must be boolean expressions'
      );
      return;
    }
    const joinRel = inStruct.structRelationship;
    if (isJoinOn(joinRel)) {
      joinRel.onExpression = exprX.value;
    }
  }

  structDef(parameterSpace: ParameterSpace): StructDef {
    const source = this.sourceExpr.getSource();
    if (!source) {
      this.sourceExpr.sqLog(
        'invalid-join-source',
        'Cannot create a source to join from'
      );
      return ErrorFactory.structDef;
    }
    const sourceDef = source.structDef(parameterSpace);
    let matrixOperation: MatrixOperation = 'left';
    if (this.inExperiment('join_types', true)) {
      matrixOperation = this.matrixOperation;
    }

    const joinStruct: StructDef = {
      ...sourceDef,
      // MTOY: add matrix type here
      structRelationship: {
        type: this.joinType,
        matrixOperation,
      },
      location: this.location,
    };
    if (sourceDef.structSource.type === 'query') {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.refString;
      delete joinStruct.as;
    } else {
      joinStruct.as = this.name.refString;
    }
    if (this.note) {
      joinStruct.annotation = this.note;
    }
    this.document()?.rememberToAddModelAnnotations(joinStruct);
    return joinStruct;
  }
}

// mtoy todo m0 goes away
export class Joins
  extends DefinitionList<Join>
  implements QueryPropertyInterface
{
  elementType = 'joinList';
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Single;

  constructor(joins: Join[]) {
    super(joins);
  }

  queryExecute(executeFor: QueryBuilder) {
    for (const qel of this.list) {
      executeFor.inputFS.extendSource(qel);
    }
  }
}
