/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReference} from '../query-items/field-references';
import type {ExprValue} from '../types/expr-value';
import type {ExpressionDef} from '../types/expression-def';
import {ExprAggregateFunction} from './expr-aggregate-function';

export abstract class ExprAsymmetric extends ExprAggregateFunction {
  constructor(
    readonly func: 'sum' | 'avg',
    readonly expr: ExpressionDef | undefined,
    readonly source?: FieldReference,
    explicitSource?: boolean
  ) {
    super(func, expr, explicitSource);
    this.has({source: source});
  }

  isSymmetricFunction() {
    return false;
  }

  returns(ev: ExprValue): ExprValue {
    return ev;
  }

  defaultFieldName(): undefined | string {
    if (this.source && this.expr === undefined) {
      const tag = this.source.nameString;
      switch (this.func) {
        case 'sum':
          return `total_${tag}`;
        case 'avg':
          return `avg_${tag}`;
      }
    }
    return undefined;
  }
}
