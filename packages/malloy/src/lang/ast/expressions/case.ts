/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {ValueOrRange} from '../types/morphic-value';
import {choice, isMisfit} from '../types/morphic-value';
import type {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import * as TDU from '../typedesc-utils';
import type {CaseExpr} from '../../../model';
import {booleanValueError, CHOICE_HINT} from './boolean-value';

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

  protected computeExpression(fs: FieldSpace): ValueOrRange {
    const dependents: ExprValue[] = [];
    let value: ExprValue | undefined = undefined;
    if (this.value) {
      const v = this.value.getExpression(fs);
      const noSubject = booleanValueError(
        fs,
        v,
        'as the subject of a case',
        this.value,
        'write the conditions, case when … then …'
      );
      if (noSubject) return noSubject;
      dependents.push(v);
      value = v;
    }
    const whens = this.choices.map(c => c.when.getExpression(fs));
    for (const when of whens) {
      if (value !== undefined) {
        if (!TDU.typeEq(when, value)) {
          return this.loggedErrorExpr('case-when-type-does-not-match', {
            whenType: when.type,
            valueType: value.type,
          });
        }
      } else {
        if (!TDU.typeEq(when, TDU.boolT)) {
          return this.loggedErrorExpr('case-when-must-be-boolean', {
            whenType: when.type,
          });
        }
      }
    }
    const thens = this.choices.map(c => c.then.getValueOrRange(fs));
    const elseValue = this.elseValue?.getValueOrRange(fs);
    const result = choice(
      elseValue ? [...thens, elseValue] : thens,
      values => {
        const resultExpr: CaseExpr = {
          node: 'case',
          kids: {
            caseWhen: whens.map(w => w.value),
            caseThen: values.slice(0, thens.length),
          },
        };
        if (value) {
          resultExpr.kids.caseValue = value.value;
        }
        if (elseValue) {
          resultExpr.kids.caseElse = values[thens.length];
        }
        return resultExpr;
      },
      [...dependents, ...whens]
    );
    if (isMisfit(result)) {
      return result.misfitAt < thens.length
        ? this.loggedErrorExpr('case-then-type-does-not-match', {
            thenType: result.found,
            returnType: result.expected,
          })
        : this.loggedErrorExpr('case-else-type-does-not-match', {
            elseType: result.found,
            returnType: result.expected,
          });
    }
    return (
      booleanValueError(
        fs,
        result,
        'as the result of a case',
        this,
        CHOICE_HINT
      ) ?? result
    );
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
