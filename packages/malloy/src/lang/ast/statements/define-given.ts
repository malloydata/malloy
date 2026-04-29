/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Annotation, GivenTypeDef} from '../../../model/malloy_types';
import type {ConstantExpression} from '../expressions/constant-expression';
import type {DocStatement, Document} from '../types/malloy-element';
import {DocStatementList, MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

/**
 * One named given declaration: `NAME :: TYPE [is EXPR]`.
 */
export class GivenDeclaration
  extends MalloyElement
  implements DocStatement, Noteable
{
  elementType = 'given';
  readonly isNoteableObj = true;
  extendNote = extendNoteMethod;
  note?: Annotation;
  readonly default?: ConstantExpression;

  constructor(
    readonly name: string,
    readonly typeDef: GivenTypeDef,
    defaultExpr?: ConstantExpression
  ) {
    super();
    if (defaultExpr) {
      this.default = defaultExpr;
      this.has({default: defaultExpr});
    }
  }

  execute(_doc: Document): void {
    // IR generation lands in a follow-up. For now the AST is built but
    // the declaration has no model-level effect. The translator-stage
    // experimental flag check (per design: gate at translate time) lands
    // alongside that work.
  }
}

/**
 * Top-level `given:` block — a sequence of given declarations.
 */
export class DefineGivens extends DocStatementList {
  elementType = 'defineGivens';
  readonly givens: GivenDeclaration[];
  constructor(givens: GivenDeclaration[]) {
    super(givens);
    this.givens = givens;
  }
}
