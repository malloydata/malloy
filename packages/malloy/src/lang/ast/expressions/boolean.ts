/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import type {ExprValue} from '../types/expr-value';
import {ExpressionDef} from '../types/expression-def';
import * as TDU from '../typedesc-utils';

export class Boolean extends ExpressionDef {
  elementType = 'boolean literal';
  constructor(readonly value: 'true' | 'false') {
    super();
  }

  getExpression(): ExprValue {
    return {...TDU.boolT, value: {node: this.value}};
  }

  getStableLiteral(): Malloy.LiteralValue {
    return {
      kind: 'boolean_literal',
      boolean_value: this.value === 'true',
    };
  }
}
