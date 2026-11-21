/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ExprCompare} from './expr-compare';
import type {ExpressionDef} from '../types/expression-def';
import type {ValueOrRange} from '../types/morphic-value';
import type {FieldSpace} from '../types/field-space';
import {applyTest} from './apply-test';

export class Apply extends ExprCompare {
  elementType = 'apply';
  constructor(
    readonly left: ExpressionDef,
    readonly right: ExpressionDef
  ) {
    super(left, '=', right);
  }

  protected computeExpression(fs: FieldSpace): ValueOrRange {
    return applyTest(fs, this.left, this.right, this);
  }
}
