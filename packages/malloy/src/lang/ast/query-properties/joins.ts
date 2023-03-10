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

import {Expr, isJoinOn, StructDef} from '../../../model/malloy_types';
import {Source} from '../elements/source';
import {compressExpr} from '../expressions/utils';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {
  ListOf,
  MalloyElement,
  ModelEntryReference,
} from '../types/malloy-element';

export abstract class Join extends MalloyElement {
  abstract name: ModelEntryReference;
  abstract structDef(): StructDef;
  abstract fixupJoinOn(outer: FieldSpace, inStruct: StructDef): void;
}

export class KeyJoin extends Join {
  elementType = 'joinOnKey';
  constructor(
    readonly name: ModelEntryReference,
    readonly source: Source,
    readonly keyExpr: ExpressionDef
  ) {
    super({name: name, source: source, keyExpr: keyExpr});
  }

  structDef(): StructDef {
    const sourceDef = this.source.structDef();
    const joinStruct: StructDef = {
      ...sourceDef,
      structRelationship: {
        type: 'one',
        onExpression: ["('join fixup'='not done yet')"],
      },
      location: this.location,
    };
    if (sourceDef.structSource.type === 'query') {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.refString;
    } else {
      joinStruct.as = this.name.refString;
    }

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
            onExpression: [
              {
                type: 'field',
                path: `${this.name}.${inStruct.primaryKey}`,
              },
              '=',
              ...exprX.value,
            ],
          };
          return;
        } else {
          this.log(
            `join_one: with type mismatch with primary key: ${exprX.dataType}/${pkey.type}`
          );
        }
      } else {
        this.log(`join_one: Primary key '${pkey}' not found in source`);
      }
    } else {
      this.log('join_one: Cannot use with unless source has a primary key');
    }
  }
}

type ExpressionJoinType = 'many' | 'one' | 'cross';
export class ExpressionJoin extends Join {
  elementType = 'joinOnExpr';
  joinType: ExpressionJoinType = 'one';
  private expr?: ExpressionDef;
  constructor(readonly name: ModelEntryReference, readonly source: Source) {
    super({name: name, source: source});
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
      this.log('join conditions must be boolean expressions');
      return;
    }
    const joinRel = inStruct.structRelationship;
    if (isJoinOn(joinRel)) {
      joinRel.onExpression = compressExpr(exprX.value);
    }
  }

  structDef(): StructDef {
    const sourceDef = this.source.structDef();
    const joinStruct: StructDef = {
      ...sourceDef,
      structRelationship: {type: this.joinType},
      location: this.location,
    };
    if (sourceDef.structSource.type === 'query') {
      // the name from query does not need to be preserved
      joinStruct.name = this.name.refString;
      delete joinStruct.as;
    } else {
      joinStruct.as = this.name.refString;
    }
    return joinStruct;
  }
}

export class Joins extends ListOf<Join> {
  constructor(joins: Join[]) {
    super('joinList', joins);
  }
}
