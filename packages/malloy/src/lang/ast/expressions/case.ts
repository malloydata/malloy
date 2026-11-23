/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import type {FieldSpace} from '../types/field-space';
import type {Forms} from '../types/forms';
import {choose, defaultMoment, formsOf, isMisfit} from '../types/forms';
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

  protected computeExpression(fs: FieldSpace): ExprValue {
    return defaultMoment(this.computeForms(fs));
  }

  protected computeForms(fs: FieldSpace): Forms {
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
      if (noSubject) return formsOf(noSubject);
      dependents.push(v);
      value = v;
    }
    // Every arm is evaluated before any is checked, so an error inside a
    // result is reported along with a `when` of the wrong type
    const whens = this.choices.map(c => c.when.getExpression(fs));
    const results = this.choices.map(c => c.then.getForms(fs));
    if (this.elseValue) {
      results.push(this.elseValue.getForms(fs));
    }
    for (const when of whens) {
      if (value !== undefined) {
        if (!TDU.typeEq(when, value)) {
          return formsOf(
            this.loggedErrorExpr('case-when-type-does-not-match', {
              whenType: when.type,
              valueType: value.type,
            })
          );
        }
      } else if (!TDU.typeEq(when, TDU.boolT)) {
        return formsOf(
          this.loggedErrorExpr('case-when-must-be-boolean', {
            whenType: when.type,
          })
        );
      }
    }
    dependents.push(...whens);
    const caseValue = value?.value;
    const caseWhen = whens.map(w => w.value);
    const chosen = choose(
      results,
      (parts): CaseExpr => ({
        node: 'case',
        kids: {
          ...(caseValue ? {caseValue} : {}),
          caseWhen,
          caseThen: parts.slice(0, caseWhen.length),
          ...(this.elseValue ? {caseElse: parts[caseWhen.length]} : {}),
        },
      }),
      dependents
    );
    if (isMisfit(chosen)) {
      if (chosen.misfitAt < this.choices.length) {
        return formsOf(
          this.loggedErrorExpr('case-then-type-does-not-match', {
            thenType: chosen.found,
            returnType: chosen.expected,
          })
        );
      }
      return formsOf(
        this.loggedErrorExpr('case-else-type-does-not-match', {
          elseType: chosen.found,
          returnType: chosen.expected,
        })
      );
    }
    if (defaultMoment(chosen).type === 'filter expression') {
      return formsOf(
        this.loggedErrorExpr(
          'filter-expression-error',
          'Case statements cannot have filter expression values'
        )
      );
    }
    const noCase = booleanValueError(
      fs,
      defaultMoment(chosen),
      'as the result of a case',
      this,
      CHOICE_HINT
    );
    if (noCase) return formsOf(noCase);
    return chosen;
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
