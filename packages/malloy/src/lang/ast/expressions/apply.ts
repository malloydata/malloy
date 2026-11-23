/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ExprCompare} from './expr-compare';
import type {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import type {Forms} from '../types/forms';
import {defaultMoment} from '../types/forms';
import {applyTestForms} from './apply-test';

export class Apply extends ExprCompare {
  elementType = 'apply';
  constructor(
    readonly left: ExpressionDef,
    readonly right: ExpressionDef
  ) {
    super(left, '=', right);
  }

  protected computeExpression(fs: FieldSpace): ExprValue {
    return defaultMoment(this.computeForms(fs));
  }

  protected computeForms(fs: FieldSpace): Forms {
    return applyTestForms(fs, this.left, this.right, this);
  }
}
