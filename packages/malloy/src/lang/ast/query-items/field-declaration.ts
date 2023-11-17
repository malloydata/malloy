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

import {Dialect} from '../../../dialect/dialect';
import {
  Annotation,
  FieldTypeDef,
  isAtomicFieldType,
  StructDef,
  TypeDesc,
  FieldDef,
  QueryFieldDef,
} from '../../../model/malloy_types';

import {compressExpr} from '../expressions/utils';
import {FT} from '../fragtype-utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldName, FieldSpace, QueryFieldSpace} from '../types/field-space';
import {isGranularResult} from '../types/granular-result';
import {LookupResult} from '../types/lookup-result';
import {MalloyElement} from '../types/malloy-element';
import {MakeEntry, SpaceEntry} from '../types/space-entry';
import {
  typecheckAggregate,
  typecheckCalculate,
  typecheckDeclare,
  typecheckDimension,
  typecheckGroupBy,
  typecheckMeasure,
  typecheckProject,
} from './typecheck_utils';
import {extendNoteMethod, Noteable} from '../types/noteable';
import {DynamicSpace} from '../field-space/dynamic-space';
import {SpaceField} from '../types/space-field';

export type FieldDeclarationConstructor = new (
  expr: ExpressionDef,
  defineName: string,
  exprSrc?: string
) => FieldDeclaration;

export abstract class FieldDeclaration
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

  fieldDef(fs: FieldSpace, exprName: string): FieldTypeDef {
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

  queryFieldDef(exprFS: FieldSpace, exprName: string): FieldTypeDef {
    let exprValue;

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
      this.log(`Cannot define '${exprName}', ${error.message}`);
      return {
        name: exprName,
        type: 'error',
      };
    }
    const compressValue = compressExpr(exprValue.value);
    const retType = exprValue.dataType;
    if (isAtomicFieldType(retType) && retType !== 'error') {
      const template: FieldTypeDef = {
        name: exprName,
        type: retType,
        location: this.location,
      };
      if (compressValue.length > 0) {
        template.e = compressValue;
      }
      if (exprValue.expressionType) {
        template.expressionType = exprValue.expressionType;
      }
      this.typecheckExprValue(exprValue);
      if (this.exprSrc) {
        template.code = this.exprSrc;
      }
      // TODO this should work for dates too
      if (isGranularResult(exprValue) && template.type === 'timestamp') {
        template.timeframe = exprValue.timeframe;
      }
      if (this.note) {
        template.annotation = this.note;
      }
      return template;
    }
    const circularDef = exprFS instanceof DefSpace && exprFS.foundCircle;
    if (!circularDef) {
      if (exprValue.dataType !== 'error') {
        const badType = FT.inspect(exprValue);
        this.log(`Cannot define '${exprName}', unexpected type: ${badType}`);
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

export class CalculateFieldDeclaration extends FieldDeclaration {
  elementType = 'calculateFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckCalculate(expr, this);
  }
  executesInOutputSpace(): boolean {
    return true;
  }
}

export class AggregateFieldDeclaration extends FieldDeclaration {
  elementType = 'aggregateFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckAggregate(expr, this);
  }
}

export class GroupByFieldDeclaration extends FieldDeclaration {
  elementType = 'groupByFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckGroupBy(expr, this);
  }
}

export class ProjectFieldDeclaration extends FieldDeclaration {
  elementType = 'projectFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckProject(expr, this);
  }
}

export class DeclareFieldDeclaration extends FieldDeclaration {
  elementType = 'declareFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckDeclare(expr, this);
  }
}

export class MeasureFieldDeclaration extends FieldDeclaration {
  elementType = 'measureFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckMeasure(expr, this);
  }
}

export class DimensionFieldDeclaration extends FieldDeclaration {
  elementType = 'dimensionFieldDeclaration';
  typecheckExprValue(expr: ExprValue) {
    typecheckDimension(expr, this);
  }
}

/**
 * Used to detect references to fields in the statement which defines them
 */
export class DefSpace implements FieldSpace {
  readonly type = 'fieldSpace';
  foundCircle = false;
  constructor(
    readonly realFS: FieldSpace,
    readonly circular: FieldDeclaration
  ) {}
  structDef(): StructDef {
    return this.realFS.structDef();
  }
  emptyStructDef(): StructDef {
    return this.realFS.emptyStructDef();
  }
  entry(name: string): SpaceEntry | undefined {
    return this.realFS.entry(name);
  }
  lookup(symbol: FieldName[]): LookupResult {
    if (symbol[0] && symbol[0].refString === this.circular.defineName) {
      this.foundCircle = true;
      return {
        error: `Circular reference to '${this.circular.defineName}' in definition`,
        found: undefined,
      };
    }
    return this.realFS.lookup(symbol);
  }
  entries(): [string, SpaceEntry][] {
    return this.realFS.entries();
  }
  dialectObj(): Dialect | undefined {
    return this.realFS.dialectObj();
  }
  isQueryFieldSpace(): this is QueryFieldSpace {
    return this.realFS.isQueryFieldSpace();
  }

  outputSpace() {
    if (this.realFS.isQueryFieldSpace()) {
      return this.realFS.outputSpace();
    }
    throw new Error('Not a query field space');
  }

  inputSpace() {
    if (this.realFS.isQueryFieldSpace()) {
      return this.realFS.inputSpace();
    }
    throw new Error('Not a query field space');
  }
}

export class FieldDefinitionValue extends SpaceField {
  fieldName: string;
  constructor(
    readonly space: FieldSpace,
    readonly exprDef: FieldDeclaration
  ) {
    super();
    this.fieldName = exprDef.defineName;
  }

  get name(): string {
    return this.fieldName;
  }

  // A source will call this when it defines the field
  fieldDef(): FieldDef {
    if (!this.haveFieldDef) {
      this.haveFieldDef = this.exprDef.fieldDef(this.space, this.name);
    }
    return this.haveFieldDef;
  }

  // A query will call this when it defined the field
  private qfd?: FieldTypeDef;
  getQueryFieldDef(fs: FieldSpace): QueryFieldDef {
    if (!this.qfd) {
      const def = this.exprDef.queryFieldDef(fs, this.name);
      this.qfd = def;
    }
    return this.qfd;
  }

  // If this is called before the expression has been evaluated, we don't
  // really know what type we have. However since we have the FieldSpace,
  // we can compile the expression to find out, this might result in
  // some expressions being compiled twice.
  typeDesc(): TypeDesc {
    const typeFrom = this.qfd || this.fieldDef();
    return this.fieldTypeFromFieldDef(typeFrom);
  }
}
