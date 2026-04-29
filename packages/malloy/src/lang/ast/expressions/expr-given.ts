/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {GivenRefNode} from '../../../model/malloy_types';
import {ExpressionDef} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import {literalExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';

/**
 * Reference to a given inside an expression: `$NAME`.
 *
 * Resolution bypasses `fs.lookup` (which is source-scoped) and goes
 * straight to the document's given namespace — that lets `$NAME` work
 * even inside a `ConstantFieldSpace`, which is how default values
 * (`given: B :: number is $A + 1`) refuse field references but accept
 * other givens.
 */
export class GivenReference extends ExpressionDef {
  elementType = 'givenReference';
  constructor(readonly name: string) {
    super();
  }

  getExpression(_fs: FieldSpace): ExprValue {
    const doc = this.document();
    const entry = doc?.getEntry(this.name)?.entry;
    if (entry === undefined) {
      return this.loggedErrorExpr(
        'given-not-found',
        `\`$${this.name}\` is not a declared given`
      );
    }
    if (entry.type !== 'given') {
      return this.loggedErrorExpr(
        'given-not-found',
        `\`$${this.name}\` is not a given (found ${entry.type})`
      );
    }
    const given = doc?.documentGivens.get(entry.id);
    if (given === undefined) {
      return this.loggedErrorExpr(
        'given-not-found',
        `Internal error: given \`$${this.name}\` is in the namespace but has no declaration. Likely a compiler bug.`
      );
    }
    const refNode: GivenRefNode = {
      node: 'given',
      id: entry.id,
      refName: this.name,
    };
    return literalExprValue({value: refNode, dataType: given.type});
  }
}
