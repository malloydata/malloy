/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {ExprValue, computedExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {FT} from '../fragtype-utils';
import {CaseExpr} from '../../../model';

interface Choice {
  then: ExprValue;
  when: ExprValue;
}

function typeCoalesce(ev1: ExprValue | undefined, ev2: ExprValue): ExprValue {
  return ev1 === undefined ||
    ev1.dataType === 'null' ||
    ev1.dataType === 'error'
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
      value = this.value.getExpression(fs);
      dependents.push(value);
      resultExpr.kids.caseValue = value.value;
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
        if (!FT.typeEq(aChoice.when, value)) {
          return this.loggedErrorExpr('case-when-type-does-not-match', {
            whenType: aChoice.when.dataType,
            valueType: value.dataType,
          });
        }
      } else {
        if (!FT.typeEq(aChoice.when, FT.boolT)) {
          return this.loggedErrorExpr('case-when-must-be-boolean', {
            whenType: aChoice.when.dataType,
          });
        }
      }
      if (returnType && !FT.typeEq(returnType, aChoice.then, true)) {
        return this.loggedErrorExpr('case-then-type-does-not-match', {
          thenType: aChoice.then.dataType,
          returnType: returnType.dataType,
        });
      }
      returnType = typeCoalesce(returnType, aChoice.then);
      resultExpr.kids.caseWhen.push(aChoice.when.value);
      resultExpr.kids.caseThen.push(aChoice.then.value);
    }
    if (this.elseValue) {
      const elseValue = this.elseValue.getExpression(fs);
      if (returnType && !FT.typeEq(returnType, elseValue, true)) {
        return this.loggedErrorExpr('case-else-type-does-not-match', {
          elseType: elseValue.dataType,
          returnType: returnType.dataType,
        });
      }
      returnType = typeCoalesce(returnType, elseValue);
      dependents.push(elseValue);
      resultExpr.kids.caseElse = elseValue.value;
    }
    return computedExprValue({
      value: resultExpr,
      dataType: returnType?.dataType ?? 'null',
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
