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
  ExpressionType,
  FieldTypeDef,
  isAtomicFieldType,
  StructDef,
} from '../../../model/malloy_types';

import {compressExpr} from '../expressions/utils';
import {FT} from '../fragtype-utils';
import {ExpressionDef} from '../types/expression-def';
import {FieldName, FieldSpace, QueryFieldSpace} from '../types/field-space';
import {isGranularResult} from '../types/granular-result';
import {LookupResult} from '../types/lookup-result';
import {MalloyElement} from '../types/malloy-element';

export class FieldDeclaration extends MalloyElement {
  elementType = 'fieldDeclaration';
  allowedExpressionTypes: ExpressionType[] | undefined;
  executesInOutputSpace: boolean = false;

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

  queryFieldDef(exprFS: FieldSpace, exprName: string): FieldTypeDef {
    let exprValue;

    function getOutputFS() {
      if (exprFS.isQueryFieldSpace()) {
        return exprFS.outputSpace();
      }
      throw new Error('must be in a query -- weird internal error');
    }

    try {
      const fs = this.executesInOutputSpace ? getOutputFS() : exprFS;
      exprValue = this.expr.getExpression(fs);
    } catch (error) {
      this.log(`Cannot define '${exprName}', ${error.message}`);
      return {
        name: `error_defining_${exprName}`,
        type: 'string',
      };
    }
    const compressValue = compressExpr(exprValue.value);
    const retType = exprValue.dataType;
    if (isAtomicFieldType(retType)) {
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
      if (
        this.allowedExpressionTypes &&
        !this.allowedExpressionTypes.includes(exprValue.expressionType)
      ) {
        this.log(
          `invalid field definition: expected a ${this.allowedExpressionTypes.join(
            ' or '
          )} expression but got a ${
            exprValue.expressionType
          } expression instead.`
        );
      }
      if (this.exprSrc) {
        template.code = this.exprSrc;
      }
      // TODO this should work for dates too
      if (isGranularResult(exprValue) && template.type === 'timestamp') {
        template.timeframe = exprValue.timeframe;
      }
      return template;
    }
    const circularDef = exprFS instanceof DefSpace && exprFS.foundCircle;
    if (!circularDef) {
      if (exprValue.dataType === 'unknown') {
        this.log(`Cannot define '${exprName}', value has unknown type`);
      } else {
        const badType = FT.inspect(exprValue);
        this.log(`Cannot define '${exprName}', unexpected type: ${badType}`);
      }
    }
    return {
      name: `error_defining_${exprName}`,
      type: 'string',
    };
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
  dialectObj(): Dialect | undefined {
    return this.realFS.dialectObj();
  }
  whenComplete(step: () => void): void {
    this.realFS.whenComplete(step);
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
}
