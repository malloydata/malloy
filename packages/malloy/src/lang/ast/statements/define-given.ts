/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  Annotation,
  Expr,
  Given,
  GivenEntry,
  GivenTypeDef,
} from '../../../model/malloy_types';
import {
  exprHasE,
  exprHasKids,
  givenUsageFrom,
  TD,
} from '../../../model/malloy_types';
import {INLINE_LEAVES, INLINE_OPS} from '../../../model/inline_expr';
import {mkGivenID} from '../../../model/source_def_utils';
import {typeDefToString} from '../../../model/utils';
import type {ConstantExpression} from '../expressions/constant-expression';
import {checkFilterExpression, getMorphicValue} from '../types/expression-def';
import type {ExprValue} from '../types/expr-value';
import type {DocStatement, Document} from '../types/malloy-element';
import {DocStatementList, MalloyElement} from '../types/malloy-element';
import type {Noteable} from '../types/noteable';
import {extendNoteMethod} from '../types/noteable';

// `filter<T>` defaults can't be type-checked via TD.eq — the filter
// expression value shape doesn't match an atomic typeDef. Catch only
// the gross kind mismatch here; inner-content validation (filter
// syntax + T compatibility) belongs to the filter machinery at use
// site.
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
 * Walk an Expr tree and collect every node string that isn't in the
 * allowed inline operator/leaf sets.
 *
 * The translator caller is gated on a clean translation of the default
 * (`constVal.type !== 'error'`): we don't pile bad-operator errors on
 * top of a default that didn't translate cleanly for more fundamental
 * reasons (an unknown `$REF`, a type mismatch, etc.). Every bad node
 * is collected so the author sees the full list in one diagnostic.
 */
function collectInlineBadOps(e: Expr, bad: Set<string>): void {
  if (!INLINE_OPS.has(e.node) && !INLINE_LEAVES.has(e.node)) {
    bad.add(e.node);
  }
  if (exprHasE(e)) {
    collectInlineBadOps(e.e, bad);
  } else if (exprHasKids(e)) {
    for (const kid of Object.values(e.kids)) {
      if (kid === null) continue;
      if (Array.isArray(kid)) {
        for (const k of kid) collectInlineBadOps(k, bad);
      } else {
        collectInlineBadOps(kid, bad);
      }
    }
  }
}

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
    defaultExpr?: ConstantExpression,
    readonly inline: boolean = false
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

    // An inline given with no default has nothing to evaluate at bind
    // time. Log and keep going — the given still registers in the
    // namespace so downstream errors don't cascade pointlessly.
    if (this.inline && !this.default) {
      this.logError('inline-no-default', {name: this.name});
    }

    // Default expression. ConstantExpression evaluates through a
    // ConstantFieldSpace that errors on every name lookup, so any
    // non-constant subexpression (field refs, aggregates, etc.) gets
    // logged here. `$NAME` references bypass that field space (see
    // GivenReference.getExpression) so given-to-given refs in defaults
    // are allowed.
    let defaultExpr: Given['default'];
    let givenUsage: Given['givenUsage'];
    if (this.default) {
      const constVal = this.default.constantValue();
      if (constVal.type !== 'error') {
        // `X :: timestamp is @2024-01-01` works because date literals
        // carry a morphic.timestamp. Date/timestamp are the only
        // MorphicType targets — other declared types fall through to
        // the TD.eq check below.
        const morphed =
          this.typeDef.type === 'date' || this.typeDef.type === 'timestamp'
            ? getMorphicValue(constVal, this.typeDef.type)
            : undefined;
        // `filter<T>` defaults are filter-expression literals — their
        // shape doesn't match an atomic typeDef, so type-check there is
        // owned by the filter machinery, not us. `null` is implicitly
        // accepted for any declared type.
        if (
          constVal.type !== 'null' &&
          morphed === undefined &&
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
        defaultExpr = morphed?.value ?? constVal.value;
        // Build the transitive closure of givens reachable through this
        // default's expression. We only include direct refs PLUS each
        // referenced given's already-precomputed transitive (which is
        // present because Malloy requires `$X` to resolve to a given
        // declared earlier or imported). The satisfiability check then
        // becomes a flat iteration — no recursion at check time.
        //
        // For `A :: number is $B + 1` where `B :: number is $C`:
        //   - B's givenUsage was computed when B was declared = [C]
        //   - A's givenUsage = [B] ∪ B.givenUsage = [B, C]
        const directRefs = givenUsageFrom(constVal.refSummary);
        if (directRefs.length > 0) {
          const seen = new Set<string>();
          const closure: typeof directRefs = [];
          for (const g of directRefs) {
            if (seen.has(g.id)) continue;
            seen.add(g.id);
            closure.push(g);
            const refDecl = doc.documentGivens.get(g.id);
            for (const t of refDecl?.givenUsage ?? []) {
              if (seen.has(t.id)) continue;
              seen.add(t.id);
              closure.push(t);
            }
          }
          givenUsage = closure;
        }

        // Ensure inline expression is resolveable at compile time.
        if (this.inline) {
          const bad = new Set<string>();
          collectInlineBadOps(defaultExpr, bad);
          if (bad.size > 0) {
            this.default.logError('inline-bad-operator', {
              name: this.name,
              operators: [...bad].sort().join(', '),
            });
          }
        }
      }
    }

    const id = mkGivenID(this.name, this.location?.url);
    const defaultText =
      defaultExpr !== undefined ? this.default?.code : undefined;
    const givenIR: Given = {
      name: this.name,
      type: this.typeDef,
      default: defaultExpr,
      defaultText,
      givenUsage,
      location: this.location,
      annotation: this.note,
      ...(this.inline ? {inline: true} : {}),
    };
    doc.documentGivens.set(id, givenIR);

    const entry: GivenEntry = {type: 'given', name: this.name, id};
    doc.setEntry(this.name, {entry, exported: true});

    // Declaration-site reference. `location` covers the whole
    // declaration; `definition.location` points at the same place.
    // Self-referential by design — parallel to how fieldReference
    // behaves on field declarations.
    this.addReference({
      type: 'givenReference',
      text: this.name,
      location: this.location ?? {
        url: '',
        range: {
          start: {line: 0, character: 0},
          end: {line: 0, character: 0},
        },
      },
      definition: {
        type: typeDefToString(this.typeDef),
        annotation: this.note,
        location: this.location,
        defaultText,
      },
    });
  }
}

export class DefineGivens extends DocStatementList {
  elementType = 'defineGivens';
  readonly givens: GivenDeclaration[];
  constructor(givens: GivenDeclaration[]) {
    super(givens);
    this.givens = givens;
  }

  executeList(doc: Document) {
    if (this.isRestricted()) {
      this.logError(
        'restricted-construct-forbidden',
        '`given:` cannot declare new givens in a restricted query — only `$NAME` references to existing givens are allowed.'
      );
      return undefined;
    }
    return super.executeList(doc);
  }
}
