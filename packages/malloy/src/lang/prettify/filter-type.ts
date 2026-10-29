/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: FILTER TYPE — `filter<T>`
 *
 * `givenType` and `legalParamType` both have a `FILTER LT malloyBasicType GT`
 * alternative. The default leaf walker treats LT/GT as binary operators
 * (spaces both sides), which renders this as `filter < string >`. This rule
 * intercepts the two contexts and emits the four-token sequence as a glued
 * unit.
 *
 * Falls through to default child recursion when the context is the non-FILTER
 * alternative (a plain malloy type), so the type's own formatting still runs.
 */

import type * as parser from '../lib/Malloy/MalloyParser';
import type {Formatter} from './formatter';
import {L, leadingAction} from './tokens';
import {note} from './leaf';

export function formatFilterTypeOrFallback(
  f: Formatter,
  ctx: parser.GivenTypeContext | parser.LegalParamTypeContext
): void {
  const filterTok = ctx.FILTER();
  if (!filterTok) {
    for (let i = 0; i < ctx.childCount; i++) f.format(ctx.getChild(i));
    return;
  }
  const action = leadingAction(f.lastEmittedType, L.FILTER);
  if (action === 'glue') f.o.trimTrailingSpace();
  else if (action === 'space') f.o.space();
  const typeCtx = ctx.malloyBasicType()!;
  f.o.text(`filter<${typeCtx.text}>`);
  const gtTok = ctx.GT()!.symbol;
  note(f, L.GT, gtTok.tokenIndex, gtTok);
}
