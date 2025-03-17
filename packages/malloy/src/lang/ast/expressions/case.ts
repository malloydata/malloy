/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ExprValue} from '../types/expr-value';
import {computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import * as TDU from '../typedesc-utils';
import type {CaseExpr} from '../../../model';

interface Choice {
  then: ExprValue;
  when: ExprValue;
}

function typeCoalesce(ev1: ExprValue | undefined, ev2: ExprValue): ExprValue {
  return ev1 === undefined || ev1.type === 'null' || ev1.type === 'error'
    ? ev2
    : ev1;
}

export class Case extends ExpressionDef {
  elementType = 'case';
  constructor(
    readonly value: ExpressionDef | undefined,
    readonly choices: CaseWhen[],
    readonly elseValue?: ExpressionDef
  ) {
    super({choices});
    this.has({elseValue, value});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const resultExpr: CaseExpr = {
      node: 'case',
      kids: {
        caseWhen: [],
        caseThen: [],
      },
    };
    const dependents: ExprValue[] = [];
    let value: ExprValue | undefined = undefined;
    if (this.value) {
      const v = this.value.getExpression(fs);
      dependents.push(v);
      resultExpr.kids.caseValue = v.value;
      value = v;
    }
    const choiceValues: Choice[] = [];
    for (const c of this.choices) {
      const when = c.when.getExpression(fs);
      const then = c.then.getExpression(fs);
      choiceValues.push({when, then});
      dependents.push(when, then);
    }
    let returnType: ExprValue | undefined;
    for (const aChoice of choiceValues) {
      if (value !== undefined) {
        if (!TDU.typeEq(aChoice.when, value)) {
          return this.loggedErrorExpr('case-when-type-does-not-match', {
            whenType: aChoice.when.type,
            valueType: value.type,
          });
        }
      } else {
        if (!TDU.typeEq(aChoice.when, TDU.boolT)) {
          return this.loggedErrorExpr('case-when-must-be-boolean', {
            whenType: aChoice.when.type,
          });
        }
      }
      if (returnType && !TDU.typeEq(returnType, aChoice.then, true)) {
        return this.loggedErrorExpr('case-then-type-does-not-match', {
          thenType: aChoice.then.type,
          returnType: returnType.type,
        });
      }
      returnType = typeCoalesce(returnType, aChoice.then);
      resultExpr.kids.caseWhen.push(aChoice.when.value);
      resultExpr.kids.caseThen.push(aChoice.then.value);
    }
    if (this.elseValue) {
      const elseValue = this.elseValue.getExpression(fs);
      if (returnType && !TDU.typeEq(returnType, elseValue, true)) {
        return this.loggedErrorExpr('case-else-type-does-not-match', {
          elseType: elseValue.type,
          returnType: returnType.type,
        });
      }
      returnType = typeCoalesce(returnType, elseValue);
      dependents.push(elseValue);
      resultExpr.kids.caseElse = elseValue.value;
    }
    return computedExprValue({
      value: resultExpr,
      dataType: returnType ? TDU.atomicDef(returnType) : {type: 'null'},
      from: dependents,
    });
  }
}

export class CaseWhen extends MalloyElement {
  elementType = 'caseWhen';
  constructor(
    readonly when: ExpressionDef,
    readonly then: ExpressionDef
  ) {
    super({when, then});
  }
}
