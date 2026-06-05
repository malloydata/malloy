/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  AnnotationsDef,
  JoinFieldDef,
  JoinType,
  MatrixOperation,
  SourceDef,
  AccessModifierLabel,
  Expr,
  FieldUsage,
} from '../../../model/malloy_types';
import {activeName, isSourceDef, isJoinable} from '../../../model/malloy_types';
import type {DynamicSpace} from '../field-space/dynamic-space';
import {JoinSpaceField} from '../field-space/join-space-field';
import {DefinitionList} from '../types/definition-list';
import type {QueryBuilder} from '../types/query-builder';
import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {ModelEntryReference} from '../types/malloy-element';
import {MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import type {MakeEntry} from '../types/space-entry';
import type {SourceQueryElement} from '../source-query-elements/source-query-element';
import {ErrorFactory} from '../error-factory';
import type {ParameterSpace} from '../field-space/parameter-space';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {LegalRefinementStage} from '../types/query-property-interface';
import {mergeRefSummaries} from '../../composite-source-utils';

export abstract class Join
  extends MalloyElement
  implements Noteable, MakeEntry
{
  abstract name: ModelEntryReference;
  abstract getStructDef(parameterSpace: ParameterSpace): JoinFieldDef;
  abstract fixupJoinOn(outer: FieldSpace, inStruct: JoinFieldDef): void;
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  abstract sourceExpr: SourceQueryElement;
  note?: AnnotationsDef;

  makeEntry(fs: DynamicSpace) {
    fs.newEntry(
      this.name.refString,
      this,
      new JoinSpaceField(
        fs.parameterSpace(),
        this,
        fs.dialectName(),
        fs.connectionName()
      )
    );
  }

  getName(): string {
    return this.name.refString;
  }

  protected getStructDefFromExpr(parameterSpace: ParameterSpace): SourceDef {
    const source = this.sourceExpr.getSource();
    if (!source) {
      this.sourceExpr.sqLog(
        'invalid-join-source',
        'Cannot create a source to join from'
      );
      return ErrorFactory.structDef;
    }
    return source.getSourceDef(parameterSpace);
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

  getStructDef(parameterSpace: ParameterSpace): JoinFieldDef {
    const sourceDef = this.getStructDefFromExpr(parameterSpace);
    if (!isJoinable(sourceDef)) {
      throw this.internalError(`Cannot join struct type '${sourceDef.type}'`);
    }
    const joinStruct: JoinFieldDef = {
      ...sourceDef,
      as: this.name.refString,
      join: 'one',
      matrixOperation: 'left',
      onExpression: {node: 'error', message: "('join fixup'='not done yet')"},
      location: this.location,
    };

    if (this.note) {
      joinStruct.annotations = {...this.note};
    }
    return joinStruct;
  }

  fixupJoinOn(outer: FieldSpace, inStruct: JoinFieldDef): void {
    const exprX = this.keyExpr.getExpression(outer);
    if (isSourceDef(inStruct) && inStruct.primaryKey) {
      const pkey = inStruct.fields.find(
        f => activeName(f) === inStruct.primaryKey
      );
      if (pkey) {
        if (pkey.type === exprX.type) {
          const keyPath = [this.name.refString, inStruct.primaryKey];
          inStruct.join = 'one';
          inStruct.onExpression = {
            node: '=',
            kids: {
              left: {
                node: 'field',
                path: keyPath,
                at: this.keyExpr.location,
              },
              right: exprX.value,
            },
          };
          inStruct.refSummary = mergeRefSummaries(exprX.refSummary, {
            fieldUsage: [{path: keyPath}],
          });
          return;
        } else {
          this.logError(
            'join-on-primary-key-type-mismatch',
            `join_one: with type mismatch with primary key: ${exprX.type}/${pkey.type}`
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

export class ExpressionJoin extends Join {
  elementType = 'joinOnExpr';
  joinType: JoinType = 'one';
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

  fixupJoinOn(outer: FieldSpace, inStruct: JoinFieldDef) {
    if (this.expr === undefined) {
      return;
    }
    const exprX = this.expr.getExpression(outer);
    if (exprX.type !== 'boolean') {
      this.logError(
        'non-boolean-join-on',
        'join conditions must be boolean expressions'
      );
      return;
    }
    inStruct.onExpression = exprX.value;
    inStruct.refSummary = exprX.refSummary;
  }

  getStructDef(parameterSpace: ParameterSpace): JoinFieldDef {
    const source = this.sourceExpr.getSource();
    if (!source) {
      this.sourceExpr.sqLog(
        'invalid-join-source',
        'Cannot create a source to join from'
      );
      return ErrorFactory.joinDef;
    }
    const sourceDef = source.getSourceDef(parameterSpace);
    let matrixOperation: MatrixOperation = 'left';
    if (this.inExperiment('join_types', true)) {
      matrixOperation = this.matrixOperation;
    }

    if (!isJoinable(sourceDef)) {
      throw this.internalError(`Can't join struct type ${sourceDef.type}`);
    }
    const joinStruct: JoinFieldDef = {
      ...sourceDef,
      as: this.name.refString,
      join: this.joinType,
      matrixOperation,
      location: this.location,
    };
    if (this.note) {
      joinStruct.annotations = {...this.note};
    }
    return joinStruct;
  }
}

export class UsingJoin extends Join {
  elementType = 'joinUsing';
  joinType: JoinType = 'one';
  matrixOperation: MatrixOperation = 'left';

  constructor(
    readonly name: ModelEntryReference,
    readonly sourceExpr: SourceQueryElement,
    readonly usingFields: string[]
  ) {
    super({name, sourceExpr});
  }

  fixupJoinOn(_outer: FieldSpace, inStruct: JoinFieldDef): void {
    // Generate an onExpression equivalence internally so Malloy's semantic
    // engine understands the lineage of the fields.
    // e.g. for `USING (id)`, we do `base_table.id = joined_table.id`.
    // We construct a boolean expression: `this.name.id = id`
    // Since there can be multiple fields, it becomes `(this.name.id = id) AND ...`
    if (this.usingFields.length === 0) {
      return;
    }

    const conditions: Expr[] = [];
    const fieldUsage: FieldUsage = [];
    for (const field of this.usingFields) {
      const left: Expr = {
        node: 'field',
        path: [this.name.refString, field],
        at: this.location,
      };
      const right: Expr = {
        node: 'field',
        path: [field],
        at: this.location,
      };
      conditions.push({node: '=', kids: {left, right}});
      fieldUsage.push({path: [this.name.refString, field]}, {path: [field]});
    }

    let onExpr: Expr = conditions[0];
    for (let i = 1; i < conditions.length; i++) {
      onExpr = {node: 'and', kids: {left: onExpr, right: conditions[i]}};
    }

    inStruct.onExpression = onExpr;
    inStruct.refSummary = mergeRefSummaries(inStruct.refSummary, {
      fieldUsage,
    });
  }

  getStructDef(parameterSpace: ParameterSpace): JoinFieldDef {
    const source = this.sourceExpr.getSource();
    if (!source) {
      this.sourceExpr.sqLog(
        'invalid-join-source',
        'Cannot create a source to join from'
      );
      return ErrorFactory.joinDef;
    }
    const sourceDef = source.getSourceDef(parameterSpace);
    let matrixOperation: MatrixOperation = 'left';
    if (this.inExperiment('join_types', true)) {
      matrixOperation = this.matrixOperation;
    }

    if (!isJoinable(sourceDef)) {
      throw this.internalError(`Can't join struct type ${sourceDef.type}`);
    }
    const joinStruct: JoinFieldDef = {
      ...sourceDef,
      name: this.name.refString,
      join: this.joinType,
      matrixOperation,
      usingFields: this.usingFields,
      location: this.location,
    };
    delete joinStruct.as;
    if (this.note) {
      joinStruct.annotation = this.note;
    }
    this.document()?.rememberToAddModelAnnotations(joinStruct);
    return joinStruct;
  }
}

export class JoinStatement
  extends DefinitionList<Join>
  implements QueryPropertyInterface
{
  elementType = 'joinStatement';
  forceQueryClass = undefined;
  queryRefinementStage = LegalRefinementStage.Single;

  constructor(
    joins: Join[],
    readonly accessModifier: AccessModifierLabel | undefined
  ) {
    super(joins);
  }

  queryExecute(executeFor: QueryBuilder) {
    for (const qel of this.list) {
      executeFor.inputFS.extendSource(qel);
      executeFor.alwaysJoins.push(qel.name.refString);
    }
  }

  get delarationNames(): string[] {
    return this.list.map(el => el.name.refString);
  }
}
