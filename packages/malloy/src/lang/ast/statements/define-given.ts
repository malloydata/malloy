/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Annotation,
  Given,
  GivenEntry,
  GivenTypeDef,
} from '../../../model/malloy_types';
import {TD} from '../../../model/malloy_types';
import {mkGivenID} from '../../../model/source_def_utils';
import {typeDefToString} from '../../../model/utils';
import type {ConstantExpression} from '../expressions/constant-expression';
import {checkFilterExpression} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import type {DocStatement, Document} from '../types/malloy-element';
import {DocStatementList, MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

/**
 * True when exactly one of `declared` and `constVal` is filter-typed.
 * Catches `filter<T>` declared with a non-filter default (and vice versa)
 * at definition time. Inner-content validation of `filter<T>` defaults
 * (syntax + compatibility with `T`) is the filter machinery's job at the
 * use site; we don't try to do it here.
 */
function filterTypeMismatch(
  declared: GivenTypeDef,
  constVal: ExprValue
): boolean {
  return (
    (declared.type === 'filter expression') !==
    (constVal.type === 'filter expression')
  );
}

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

  protected varInfo(): string {
    return ` ${this.name} :: ${typeDefToString(this.typeDef)}`;
  }

  execute(doc: Document): void {
    if (this.typeDef.type === 'error') return;

    if (doc.modelEntry(this.name)) {
      this.logError(
        'given-definition-name-conflict',
        `Cannot redefine '${this.name}'`
      );
      return;
    }

    // Default expression. ConstantExpression evaluates through a
    // ConstantFieldSpace that errors on every name lookup, so any
    // non-constant subexpression (field refs, aggregates, etc.) gets
    // logged here. `$NAME` references bypass that field space (see
    // GivenReference.getExpression) so given-to-given refs in defaults
    // are allowed.
    let defaultExpr: Given['default'];
    if (this.default) {
      const constVal = this.default.constantValue();
      if (constVal.type !== 'error') {
        // `filter<T>` defaults are filter-expression literals — their
        // shape doesn't match an atomic typeDef, so type-check there is
        // owned by the filter machinery, not us. `null` is implicitly
        // accepted for any declared type.
        if (
          constVal.type !== 'null' &&
          (filterTypeMismatch(this.typeDef, constVal) ||
            !TD.eq(this.typeDef, constVal))
        ) {
          const actual = TD.isAtomic(constVal)
            ? typeDefToString(constVal)
            : constVal.type;
          this.default.logError(
            'parameter-default-does-not-match-declared-type',
            `Default value of type \`${actual}\` does not match declared type \`${typeDefToString(this.typeDef)}\``
          );
        } else if (
          this.typeDef.type === 'filter expression' &&
          constVal.type === 'filter expression'
        ) {
          // We know T at the declaration site, so validate the filter
          // literal here even though the filter machinery will check it
          // again at use site. Catches bad filter syntax early.
          checkFilterExpression(
            this.default,
            this.typeDef.filterType,
            constVal.value
          );
        }
        defaultExpr = constVal.value;
      }
    }

    const id = mkGivenID(this.name, this.location?.url);
    const givenIR: Given = {
      name: this.name,
      type: this.typeDef,
      default: defaultExpr,
      location: this.location,
      annotation: this.note,
    };
    doc.documentGivens.set(id, givenIR);

    const entry: GivenEntry = {type: 'given', name: this.name, id};
    doc.setEntry(this.name, {entry, exported: true});
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
