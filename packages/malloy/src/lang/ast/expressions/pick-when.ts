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
  ExpressionType,
  Fragment,
  maxExpressionType,
} from '../../../model/malloy_types';

import {errorFor} from '../ast-utils';
import {FT} from '../fragtype-utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {compressExpr} from './utils';

interface Choice {
  pick: ExprValue;
  when: ExprValue;
}

function typeCoalesce(ev1: ExprValue | undefined, ev2: ExprValue): ExprValue {
  return ev1 === undefined || ev1.dataType === 'null' ? ev2 : ev1;
}

export class Pick extends ExpressionDef {
  elementType = 'pick';
  constructor(readonly choices: PickWhen[], readonly elsePick?: ExpressionDef) {
    super({choices});
    this.has({elsePick});
  }

  requestExpression(fs: FieldSpace): ExprValue | undefined {
    // pick statements are sometimes partials which must be applied
    // and sometimes have a value.
    if (this.elsePick === undefined) {
      return undefined;
    }
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return undefined;
      }
      const whenResp = c.when.requestExpression(fs);
      if (whenResp === undefined || whenResp.dataType !== 'boolean') {
        // If when is not a boolean, we'll treat it like a partial compare
        return undefined;
      }
    }
    return this.getExpression(fs);
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    const caseValue: Fragment[] = ['CASE'];
    let returnType: ExprValue | undefined;
    let anyExpressionType: ExpressionType = 'scalar';
    for (const choice of this.choices) {
      const whenExpr = choice.when.apply(fs, '=', expr);
      const thenExpr = choice.pick
        ? choice.pick.getExpression(fs)
        : expr.getExpression(fs);
      anyExpressionType = maxExpressionType(
        anyExpressionType,
        maxExpressionType(whenExpr.expressionType, thenExpr.expressionType)
      );
      if (returnType && !FT.typeEq(returnType, thenExpr, true)) {
        const whenType = FT.inspect(thenExpr);
        this.log(`pick type '${whenType}', expected '${returnType.dataType}'`);
        return errorFor('pick when type');
      }
      returnType = typeCoalesce(returnType, thenExpr);
      caseValue.push(' WHEN ', ...whenExpr.value, ' THEN ', ...thenExpr.value);
    }
    const elsePart = this.elsePick || expr;
    const elseVal = elsePart.getExpression(fs);
    returnType = typeCoalesce(returnType, elseVal);
    if (!FT.typeEq(returnType, elseVal, true)) {
      const errSrc = this.elsePick ? 'else' : 'pick default';
      this.log(
        `${errSrc} type '${FT.inspect(elseVal)}', expected '${
          returnType.dataType
        }'`
      );
      return errorFor('pick else type');
    }
    return {
      dataType: returnType.dataType,
      expressionType: maxExpressionType(
        anyExpressionType,
        elseVal.expressionType
      ),
      value: compressExpr([...caseValue, ' ELSE ', ...elseVal.value, ' END']),
    };
  }

  getExpression(fs: FieldSpace): ExprValue {
    if (this.elsePick === undefined) {
      this.log("pick incomplete, missing 'else'");
      return errorFor('no value for partial pick');
    }

    const choiceValues: Choice[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        this.log('pick with no value can only be used with apply');
        return errorFor('no value for partial pick');
      }
      const pickWhen = c.when.requestExpression(fs);
      if (pickWhen === undefined) {
        this.log('pick with partial when can only be used with apply');
        return errorFor('partial when');
      }
      choiceValues.push({
        pick: c.pick.getExpression(fs),
        when: c.when.getExpression(fs),
      });
    }
    let returnType: ExprValue | undefined;
    const caseValue: Fragment[] = ['CASE'];
    let anyExpressionType: ExpressionType = 'scalar';
    for (const aChoice of choiceValues) {
      if (!FT.typeEq(aChoice.when, FT.boolT)) {
        this.log(
          `when expression must be boolean, not '${FT.inspect(aChoice.when)}`
        );
        return errorFor('pick when type');
      }
      if (returnType && !FT.typeEq(returnType, aChoice.pick, true)) {
        const whenType = FT.inspect(aChoice.pick);
        this.log(`pick type '${whenType}', expected '${returnType.dataType}'`);
        return errorFor('pick value type');
      }
      returnType = typeCoalesce(returnType, aChoice.pick);
      anyExpressionType = maxExpressionType(
        anyExpressionType,
        maxExpressionType(
          aChoice.pick.expressionType,
          aChoice.when.expressionType
        )
      );
      caseValue.push(
        ' WHEN ',
        ...aChoice.when.value,
        ' THEN ',
        ...aChoice.pick.value
      );
    }
    const defVal = this.elsePick.getExpression(fs);
    anyExpressionType = maxExpressionType(
      anyExpressionType,
      defVal.expressionType
    );
    returnType = typeCoalesce(returnType, defVal);
    if (!FT.typeEq(returnType, defVal, true)) {
      this.elsePick.log(
        `else type '${FT.inspect(defVal)}', expected '${returnType.dataType}'`
      );
      return errorFor('pick value type mismatch');
    }
    caseValue.push(' ELSE ', ...defVal.value, ' END');
    return {
      dataType: returnType.dataType,
      expressionType: anyExpressionType,
      value: compressExpr(caseValue),
    };
  }
}

export class PickWhen extends MalloyElement {
  elementType = 'pickWhen';
  constructor(
    readonly pick: ExpressionDef | undefined,
    readonly when: ExpressionDef
  ) {
    super({when: when});
    this.has({pick: pick});
  }
}
