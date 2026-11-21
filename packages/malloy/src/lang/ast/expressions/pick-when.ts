/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CaseExpr} from '../../../model/malloy_types';

import * as TDU from '../typedesc-utils';
import type {BinaryMalloyOperator} from '../types/binary_operators';
import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ATNodeType, ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {booleanValueError, CHOICE_HINT} from './boolean-value';

interface Choice {
  pick: ExprValue;
  when: ExprValue;
}

function typeCoalesce(ev1: ExprValue | undefined, ev2: ExprValue): ExprValue {
  if (ev1 === undefined || ev1.type === 'null' || ev1.type === 'error') {
    return ev2;
  }
  // If both are numbers but subtypes differ, strip the subtype
  if (ev1.type === 'number' && ev2.type === 'number') {
    if (ev1.numberType !== ev2.numberType) {
      return {...ev1, numberType: undefined};
    }
  }
  return ev1;
}

/**
 * The type of a pick is the type of a choice, and a choice is a whole value.
 * Its `morphic` is that one choice written another way, which is not the
 * pick written another way.
 */
function typeOfPick(choice: ExprValue): ExprValue {
  return {...choice, morphic: undefined};
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

  /**
   * `?` applies a pick, an operator written in the source compares with the
   * value of a pick.
   */
  apply(
    fs: FieldSpace,
    op: BinaryMalloyOperator,
    expr: ExpressionDef,
    byApplyOperator = false
  ): ExprValue {
    if (!byApplyOperator) {
      return super.apply(fs, op, expr);
    }
    const caseValue: CaseExpr = {
      node: 'case',
      kids: {
        caseWhen: [],
        caseThen: [],
      },
    };
    let returnType: ExprValue | undefined;
    const dependents: ExprValue[] = [];
    for (const choice of this.choices) {
      const whenExpr = choice.when.apply(fs, '=', expr, true);
      if (whenExpr.type !== 'boolean' && whenExpr.type !== 'error') {
        return choice.when.loggedErrorExpr('applied-is-not-a-test', {
          resultType: whenExpr.type,
        });
      }
      const thenExpr = choice.pick
        ? choice.pick.getExpression(fs)
        : expr.getExpression(fs);
      dependents.push(whenExpr, thenExpr);
      if (returnType && !TDU.typeEq(returnType, thenExpr, true)) {
        return this.loggedErrorExpr('pick-type-does-not-match', {
          pickType: thenExpr.type,
          returnType: returnType.type,
        });
      }
      returnType = typeCoalesce(returnType, thenExpr);
      caseValue.kids.caseWhen.push(whenExpr.value);
      caseValue.kids.caseThen.push(thenExpr.value);
    }
    const elseVal = this.elsePick?.getExpression(fs);
    const exprVal = expr.getExpression(fs);
    dependents.push(exprVal);
    if (elseVal) dependents.push(elseVal);
    const defaultVal = elseVal ?? exprVal;
    const definedReturnType = typeCoalesce(returnType, defaultVal);
    if (!TDU.typeEq(definedReturnType, defaultVal, true)) {
      if (this.elsePick) {
        return this.loggedErrorExpr('pick-else-type-does-not-match', {
          elseType: defaultVal.type,
          returnType: definedReturnType.type,
        });
      } else {
        return this.loggedErrorExpr('pick-default-type-does-not-match', {
          defaultType: defaultVal.type,
          returnType: definedReturnType.type,
        });
      }
    }
    if (definedReturnType.type === 'filter expression') {
      return this.loggedErrorExpr(
        'filter-expression-error',
        'Pick statments cannot have filter expression values'
      );
    }
    const noPick = booleanValueError(
      fs,
      definedReturnType,
      'as the result of a pick',
      this,
      CHOICE_HINT
    );
    if (noPick) return noPick;
    caseValue.kids.caseElse = defaultVal.value;
    return computedExprValue({
      dataType: typeOfPick(definedReturnType),
      value: caseValue,
      from: dependents,
    });
  }

  atNodeType(byApplyOperator = false): ATNodeType {
    return byApplyOperator ? ATNodeType.Applied : ATNodeType.Value;
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    const pick: CaseExpr = {
      node: 'case',
      kids: {
        caseWhen: [],
        caseThen: [],
      },
    };
    // The shapes which make this a pick to be applied are reported first, as
    // the way out of all of them is the same.
    for (const c of this.choices) {
      if (c.pick === undefined) {
        return this.loggedErrorExpr('pick-missing-value', {});
      }
      if (c.when.requestExpression(fs) === undefined) {
        return c.when.loggedErrorExpr('pick-illegal-partial', {});
      }
    }
    if (this.elsePick === undefined) {
      return this.loggedErrorExpr('pick-missing-else', {});
    }

    const choiceValues: Choice[] = [];
    const dependents: ExprValue[] = [];
    for (const c of this.choices) {
      if (c.pick === undefined) {
        throw this.internalError(
          'a pick with nothing to pick was already refused'
        );
      }
      const pick = c.pick.getExpression(fs);
      const when = c.when.getExpression(fs);
      choiceValues.push({pick, when});
      dependents.push(pick, when);
    }
    let returnType: ExprValue | undefined;
    for (const aChoice of choiceValues) {
      if (!TDU.typeEq(aChoice.when, TDU.boolT)) {
        return this.loggedErrorExpr('pick-when-must-be-boolean', {
          whenType: aChoice.when.type,
        });
      }
      if (returnType && !TDU.typeEq(returnType, aChoice.pick, true)) {
        return this.loggedErrorExpr('pick-type-does-not-match', {
          pickType: aChoice.pick.type,
          returnType: returnType.type,
        });
      }
      returnType = typeCoalesce(returnType, aChoice.pick);
      pick.kids.caseWhen.push(aChoice.when.value);
      pick.kids.caseThen.push(aChoice.pick.value);
    }
    const defVal = this.elsePick.getExpression(fs);
    dependents.push(defVal);
    const definedReturnType = typeCoalesce(returnType, defVal);
    if (!TDU.typeEq(definedReturnType, defVal, true)) {
      return this.elsePick.loggedErrorExpr('pick-else-type-does-not-match', {
        elseType: defVal.type,
        returnType: definedReturnType.type,
      });
    }
    if (definedReturnType.type === 'filter expression') {
      return this.loggedErrorExpr(
        'filter-expression-error',
        'Pick statments cannot have filter expression values'
      );
    }
    const noPick = booleanValueError(
      fs,
      definedReturnType,
      'as the result of a pick',
      this,
      CHOICE_HINT
    );
    if (noPick) return noPick;
    pick.kids.caseElse = defVal.value;
    return computedExprValue({
      dataType: typeOfPick(definedReturnType),
      value: pick,
      from: dependents,
    });
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
