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
  CaseExpr,
  EvalSpace,
  ExpressionType,
  maxExpressionType,
  mergeEvalSpaces,
} from '../../../model/malloy_types';

import {TDU} from '../typedesc-utils';
import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';

interface Choice {
  pick: ExprValue;
  when: ExprValue;
}

function typeCoalesce(ev1: ExprValue | undefined, ev2: ExprValue): ExprValue {
  return ev1 === undefined || ev1.type === 'null' || ev1.type === 'error'
    ? ev2
    : ev1;
}

export class Pick extends ExpressionDef {
  elementType = 'pick';
  constructor(
    readonly choices: PickWhen[],
    readonly elsePick?: ExpressionDef
  ) {
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
      if (whenResp === undefined || whenResp.type !== 'boolean') {
        // If when is not a boolean, we'll treat it like a partial compare
        return undefined;
      }
    }
    return this.getExpression(fs);
  }

  apply(fs: FieldSpace, op: string, expr: ExpressionDef): ExprValue {
    const caseValue: CaseExpr = {
      node: 'case',
      kids: {
        caseWhen: [],
        caseThen: [],
      },
    };
    let computeReturnType: ExprValue | undefined;
    let anyExpressionType: ExpressionType = 'scalar';
    let anyEvalSpace: EvalSpace = 'constant';
    for (const choice of this.choices) {
      const whenExpr = choice.when.apply(fs, '=', expr);
      const thenExpr = choice.pick
        ? choice.pick.getExpression(fs)
        : expr.getExpression(fs);
      anyExpressionType = maxExpressionType(
        anyExpressionType,
        maxExpressionType(whenExpr.expressionType, thenExpr.expressionType)
      );
      anyEvalSpace = mergeEvalSpaces(
        anyEvalSpace,
        whenExpr.evalSpace,
        thenExpr.evalSpace
      );
      if (computeReturnType && !TDU.typeEq(computeReturnType, thenExpr, true)) {
        return this.loggedErrorExpr('pick-type-does-not-match', {
          pickType: thenExpr.type,
          returnType: computeReturnType.type,
        });
      }
      computeReturnType = typeCoalesce(computeReturnType, thenExpr);
      caseValue.kids.caseWhen.push(whenExpr.value);
      caseValue.kids.caseThen.push(thenExpr.value);
    }
    const elsePart = this.elsePick || expr;
    const elseVal = elsePart.getExpression(fs);
    // mtoy todo computeReturnType is still possibly undefined
    // this, so make a new variable ... why?
    const returnType = typeCoalesce(computeReturnType, elseVal);
    if (!TDU.typeEq(returnType, elseVal, true)) {
      if (this.elsePick) {
        return this.loggedErrorExpr('pick-else-type-does-not-match', {
          elseType: elseVal.type,
          returnType: returnType.type,
        });
      } else {
        return this.loggedErrorExpr('pick-default-type-does-not-match', {
          defaultType: elseVal.type,
          returnType: returnType.type,
        });
      }
    }
    caseValue.kids.caseElse = elseVal.value;
    return {
      ...returnType,
      expressionType: maxExpressionType(
        anyExpressionType,
        elseVal.expressionType
      ),
      evalSpace: mergeEvalSpaces(anyEvalSpace, elseVal.evalSpace),
      value: caseValue,
    };
  }

  getExpression(fs: FieldSpace): ExprValue {
    const pick: CaseExpr = {
      node: 'case',
      kids: {
        caseWhen: [],
        caseThen: [],
      },
    };
    if (this.elsePick === undefined) {
      return this.loggedErrorExpr(
        'pick-missing-else',
        "pick incomplete, missing 'else'"
      );
    }

    const choiceValues: Choice[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return this.loggedErrorExpr(
          'pick-missing-value',
          'pick with no value can only be used with apply'
        );
      }
      const caseWhen = c.when.requestExpression(fs);
      if (caseWhen === undefined) {
        this.loggedErrorExpr(
          'pick-illegal-partial',
          'pick with partial when can only be used with apply'
        );
      }
      choiceValues.push({
        pick: c.pick.getExpression(fs),
        when: c.when.getExpression(fs),
      });
    }
    let computeReturnType: ExprValue | undefined;
    let anyExpressionType: ExpressionType = 'scalar';
    let anyEvalSpace: EvalSpace = 'constant';
    for (const aChoice of choiceValues) {
      if (!TDU.typeEq(aChoice.when, TDU.boolT)) {
        return this.loggedErrorExpr('pick-when-must-be-boolean', {
          whenType: aChoice.when.type,
        });
      }
      if (
        computeReturnType &&
        !TDU.typeEq(computeReturnType, aChoice.pick, true)
      ) {
        return this.loggedErrorExpr('pick-type-does-not-match', {
          pickType: aChoice.pick.type,
          returnType: computeReturnType.type,
        });
      }
      computeReturnType = typeCoalesce(computeReturnType, aChoice.pick);
      anyExpressionType = maxExpressionType(
        anyExpressionType,
        maxExpressionType(
          aChoice.pick.expressionType,
          aChoice.when.expressionType
        )
      );
      anyEvalSpace = mergeEvalSpaces(
        anyEvalSpace,
        aChoice.pick.evalSpace,
        aChoice.when.evalSpace
      );
      pick.kids.caseWhen.push(aChoice.when.value);
      pick.kids.caseThen.push(aChoice.pick.value);
    }
    const defVal = this.elsePick.getExpression(fs);
    anyExpressionType = maxExpressionType(
      anyExpressionType,
      defVal.expressionType
    );
    anyEvalSpace = mergeEvalSpaces(anyEvalSpace, defVal.evalSpace);
    const returnType = typeCoalesce(computeReturnType, defVal);
    if (!TDU.typeEq(returnType, defVal, true)) {
      return this.elsePick.loggedErrorExpr('pick-else-type-does-not-match', {
        elseType: defVal.type,
        returnType: returnType.type,
      });
    }
    pick.kids.caseElse = defVal.value;
    return {
      ...returnType,
      expressionType: anyExpressionType,
      value: pick,
      evalSpace: anyEvalSpace,
    };
  }
}

export class PickWhen extends MalloyElement {
  elementType = 'caseWhen';
  constructor(
    readonly pick: ExpressionDef | undefined,
    readonly when: ExpressionDef
  ) {
    super({when: when});
    this.has({pick: pick});
  }
}
