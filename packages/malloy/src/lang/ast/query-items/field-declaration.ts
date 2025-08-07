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

import type {
  Annotation,
  TypeDesc,
  FieldDef,
  AtomicFieldDef,
} from '../../../model/malloy_types';
import {
  isAtomicFieldType,
  isAtomic,
  mkFieldDef,
} from '../../../model/malloy_types';

import * as TDU from '../typedesc-utils';
import type {ExprValue} from '../types/expr-value';
import type {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {isGranularResult} from '../types/granular-result';
import {MalloyElement} from '../types/malloy-element';
import type {MakeEntry} from '../types/space-entry';
import {
  typecheckAggregate,
  typecheckCalculate,
  typecheckDeclare,
  typecheckDimension,
  typecheckGroupBy,
  typecheckMeasure,
  typecheckProject,
} from './typecheck_utils';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';
import type {DynamicSpace} from '../field-space/dynamic-space';
import {SpaceField} from '../types/space-field';
import {DefSpace} from '../field-space/def-space';

export type FieldDeclarationConstructor = new (
  expr: ExpressionDef,
  defineName: string,
  exprSrc?: string
) => AtomicFieldDeclaration;

export abstract class AtomicFieldDeclaration
  extends MalloyElement
  implements Noteable, MakeEntry
{
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;

  constructor(
    readonly expr: ExpressionDef,
    readonly defineName: string,
    readonly exprSrc?: string
  ) {
    super({expr: expr});
  }

  getName(): string {
    return this.defineName;
  }

  fieldDef(fs: FieldSpace, exprName: string): FieldDef {
    /*
     * In an explore we cannot reference the thing we are defining, you need
     * to use rename. In a query, the output space is a new thing, and expressions
     * can reference the outer value in order to make a value with the new name,
     * and it feels wrong that this is HERE and not somehow in the QueryOperation.
     * For now, this stops the stack overflow, and passes all tests, but I think
     * a refactor of QueryFieldSpace might someday be the place where this should
     * happen.
     */
    return this.queryFieldDef(new DefSpace(fs, this), exprName);
  }

  abstract typecheckExprValue(expr: ExprValue): void;

  executesInOutputSpace(): boolean {
    return false;
  }

  queryFieldDef(exprFS: FieldSpace, exprName: string): AtomicFieldDef {
    let exprValue: ExprValue;

    function getOutputFS() {
      if (exprFS.isQueryFieldSpace()) {
        return exprFS.outputSpace();
      }
      throw new Error('must be in a query -- weird internal error');
    }

    try {
      const fs = this.executesInOutputSpace() ? getOutputFS() : exprFS;
      exprValue = this.expr.getExpression(fs);
    } catch (error) {
      this.logError(
        'failed-field-definition',
        `Cannot define '${exprName}', ${error.message}`
      );
      return {
        name: exprName,
        type: 'error',
      };
    }
    if (exprValue.type === 'null') {
      this.expr.logWarning(
        'null-typed-field-definition',
        'null value defaults to type number, use "null::TYPE" to specify correct type'
      );
      const nullAsNumber: ExprValue = {
        type: 'number',
        value: exprValue.value,
        expressionType: exprValue.expressionType,
        evalSpace: exprValue.evalSpace,
        fieldUsage: exprValue.fieldUsage,
        requiresGroupBy: exprValue.requiresGroupBy,
      };
      exprValue = nullAsNumber;
    }
    if (isAtomicFieldType(exprValue.type) && exprValue.type !== 'error') {
      this.typecheckExprValue(exprValue);
      const ret = mkFieldDef(TDU.atomicDef(exprValue), exprName);
      if (
        (ret.type === 'date' || ret.type === 'timestamp') &&
        isGranularResult(exprValue)
      ) {
        ret.timeframe = exprValue.timeframe;
      }
      ret.location = this.location;
      if (
        exprValue.type === 'boolean' &&
        exprFS.dialectObj()?.booleanType === 'none'
      ) {
        // when generating a boolean field on a database without boolean support
        // map it to integers
        ret.e = {
          node: 'case',
          kids: {
            caseWhen: [exprValue.value],
            caseThen: [{node: 'numberLiteral', literal: '1'}],
            caseElse: {node: 'numberLiteral', literal: '0'},
          },
        };
      } else {
        ret.e = exprValue.value;
      }
      ret.drillExpression = this.expr.drillExpression();
      ret.fieldUsage = exprValue.fieldUsage;
      ret.ungroupings = exprValue.ungroupings;
      ret.requiresGroupBy = exprValue.requiresGroupBy;
      if (exprValue.expressionType) {
        ret.expressionType = exprValue.expressionType;
      }
      if (this.exprSrc) {
        ret.code = this.exprSrc;
      }
      if (this.note) {
        ret.annotation = this.note;
      }
      return ret;
    }
    const circularDef = exprFS instanceof DefSpace && exprFS.foundCircle;
    if (!circularDef) {
      if (exprValue.type !== 'error') {
        const badType = TDU.inspect(exprValue);
        this.logError(
          'invalid-type-for-field-definition',
          `Cannot define '${exprName}', unexpected type: ${badType}`
        );
      }
    }
    return {
      name: exprName,
      type: 'error',
    };
  }

  makeEntry(fs: DynamicSpace) {
    fs.newEntry(this.defineName, this, new FieldDefinitionValue(fs, this));
  }
}

export class CalculateFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'calculateFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckCalculate(expr, this);
  }
  executesInOutputSpace(): boolean {
    return true;
  }
}

export class AggregateFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'aggregateFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckAggregate(expr, this);
  }
}

export class GroupByFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'groupByFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckGroupBy(expr, this);
  }
}

export class ProjectFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'projectFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckProject(expr, this);
  }
}

export class DeclareFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'declareFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckDeclare(expr, this);
  }
}

export class MeasureFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'measureFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckMeasure(expr, this);
  }
}

export class DimensionFieldDeclaration extends AtomicFieldDeclaration {
  elementType = 'dimensionFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckDimension(expr, this);
  }
}

export class FieldDefinitionValue extends SpaceField {
  fieldName: string;
  constructor(
    readonly space: FieldSpace,
    readonly exprDef: AtomicFieldDeclaration
  ) {
    super();
    this.fieldName = exprDef.defineName;
  }

  get name(): string {
    return this.fieldName;
  }

  // A source will call this when it defines the field
  private defInSource?: FieldDef;
  fieldDef(): FieldDef {
    // Checking `defInQuery` is necessary to support a case where a field needs
    // to be looked up from the output space (ex: in `order_by: a`), but where
    // the field is defined in a group_by expression (ex: `group_by: a.day`).
    // In this case, this.exprDef.fieldDef() only ever returns an
    // AtomicFieldDef anyways, so it is safe in this particular implementation.
    const def =
      this.defInSource ??
      this.defInQuery ??
      this.exprDef.fieldDef(this.space, this.name);
    this.defInSource = def;
    return def;
  }

  // A query will call this when it defines the field
  private defInQuery?: AtomicFieldDef;
  getQueryFieldDef(fs: FieldSpace): AtomicFieldDef {
    if (!this.defInQuery) {
      const def = this.exprDef.queryFieldDef(fs, this.name);
      this.defInQuery = def;
    }
    return this.defInQuery;
  }

  // If this is called before the expression has been evaluated, we don't
  // really know what type we have. However since we have the FieldSpace,
  // we can compile the expression to find out, this might result in
  // some expressions being compiled twice.
  typeDesc(): TypeDesc {
    const typeFrom = this.defInQuery || this.fieldDef();
    if (isAtomic(typeFrom)) {
      return this.fieldTypeFromFieldDef(typeFrom);
    }
    throw new Error(`Can't get typeDesc for ${typeFrom.type}`);
  }
}
