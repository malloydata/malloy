/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReference} from '../query-items/field-references';
import type {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import {ExprAsymmetric} from './expr-asymmetric';

export class ExprAvg extends ExprAsymmetric {
  constructor(
    expr: ExpressionDef | undefined,
    source?: FieldReference,
    explicitSource?: boolean
  ) {
    super('avg', expr, source, explicitSource);
    this.has({source: source});
  }

  /**
   * avg() always returns a float, regardless of input type.
   */
  returns(ev: ExprValue): ExprValue {
    if (ev.type === 'number') {
      return {...ev, numberType: 'float'};
    }
    return ev;
  }
}
