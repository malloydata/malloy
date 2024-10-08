/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {FT} from '../fragtype-utils';
import {
  CaseExpr,
  EvalSpace,
  ExpressionType,
  maxExpressionType,
  mergeEvalSpaces,
} from '../../../model';

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
    readonly choices: CaseWhen[],
    readonly elseValue?: ExpressionDef
  ) {
    super({choices});
    this.has({elseValue});
  }

  getExpression(fs: FieldSpace): ExprValue {
    const caseValue: CaseExpr = {
      node: 'case',
      kids: {
        caseWhen: [],
        caseThen: [],
        caseElse: null,
      },
    };
    const choiceValues: Choice[] = [];
    for (const c of this.choices) {
      const when = c.when.getExpression(fs);
      const then = c.then.getExpression(fs);
      choiceValues.push({when, then});
    }
    let returnType: ExprValue | undefined;
    let expressionType: ExpressionType = 'scalar';
    let evalSpace: EvalSpace = 'constant';
    for (const aChoice of choiceValues) {
      if (!FT.typeEq(aChoice.when, FT.boolT)) {
        return this.loggedErrorExpr('case-when-must-be-boolean', {
          whenType: aChoice.when.dataType,
        });
      }
      if (returnType && !FT.typeEq(returnType, aChoice.then, true)) {
        return this.loggedErrorExpr('case-then-type-does-not-match', {
          thenType: aChoice.then.dataType,
          returnType: returnType.dataType,
        });
      }
      returnType = typeCoalesce(returnType, aChoice.then);
      expressionType = maxExpressionType(
        expressionType,
        maxExpressionType(
          aChoice.then.expressionType,
          aChoice.when.expressionType
        )
      );
      evalSpace = mergeEvalSpaces(
        evalSpace,
        aChoice.then.evalSpace,
        aChoice.when.evalSpace
      );
      caseValue.kids.caseWhen.push(aChoice.when.value);
      caseValue.kids.caseThen.push(aChoice.then.value);
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
      expressionType = maxExpressionType(
        expressionType,
        elseValue.expressionType
      );
      evalSpace = mergeEvalSpaces(evalSpace, elseValue.evalSpace);
      caseValue.kids.caseElse = elseValue.value;
    }
    return {
      value: caseValue,
      dataType: returnType?.dataType ?? 'null',
      expressionType,
      evalSpace,
    };
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
