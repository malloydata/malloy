/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReference} from '../query-items/field-references';
import type {ExpressionDef} from '../types/expression-def';
import {ExprAsymmetric} from './expr-asymmetric';

export class ExprSum extends ExprAsymmetric {
  constructor(
    expr: ExpressionDef | undefined,
    source?: FieldReference,
    explicitSource?: boolean
  ) {
    super('sum', expr, source, explicitSource);
    this.has({source: source});
  }
}
