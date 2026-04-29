/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';

/**
 * Reference to a given inside an expression: `$NAME`.
 *
 * IR generation (resolving to a givenRef node and looking up the type)
 * lands with the IR work. For the AST-only stage this records the name
 * and reports an explicit error if used in an expression that asks for
 * a translation, so callers see a clear message rather than a crash.
 */
export class GivenReference extends ExpressionDef {
  elementType = 'givenReference';
  constructor(readonly name: string) {
    super();
  }

  getExpression(_fs: FieldSpace): ExprValue {
    return this.loggedErrorExpr(
      'given-reference-not-implemented',
      `Reference to given $${this.name}: given references are not yet implemented`
    );
  }
}
