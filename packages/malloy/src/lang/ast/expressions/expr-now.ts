/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import {ExpressionDef} from '../types/expression-def';

export class ExprNow extends ExpressionDef {
  elementType = 'timestamp';

  protected computeExpression(_fs: FieldSpace): ExprValue {
    return {
      type: 'timestamp',
      expressionType: 'scalar',
      // `now` is considered to be a constant, at least in the dialects we support today
      evalSpace: 'constant',
      value: {node: 'now', typeDef: {type: 'timestamp'}},
    };
  }
}
