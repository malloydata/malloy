/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: IMPORT SELECT — `import {a, b, c} from 'url'`
 *
 * The selection list is `{ id (IS id)? (, id (IS id)?)* }`. Inline if the
 * whole brace-and-contents fits on the current line. Otherwise wrap with
 * each item on its own line at +1 indent.
 */

import type * as parser from '../lib/Malloy/MalloyParser';
import type {Formatter} from './formatter';
import {L, LINE_BUDGET} from './tokens';
import {flushHiddenBefore, hasCommentsInRange, note} from './leaf';
import {renderItemInline} from './inline-renderer';

export function formatImportSelect(
  f: Formatter,
  ctx: parser.ImportSelectContext
): void {
  // Flush hidden tokens between the previous emit (IMPORT) and our opener
  // so a comment like `import /* tag */ {a} from 'x'` is preserved.
  flushHiddenBefore(f, ctx._start.tokenIndex);

  const items = ctx.importItem();
  // Grammar puts FROM as the last token of importSelect: emit it ourselves
  // so the trailing space and lastEmittedIdx land correctly.
  const fromTok = ctx.FROM().symbol;
  const fromIdx = fromTok.tokenIndex;
  if (items.length === 0) {
    f.o.space();
    f.o.text('{} from');
    note(f, L.FROM, fromIdx, fromTok);
    return;
  }

  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  // Comments anywhere in the items' span (between items, inside an `as is`
  // form, etc.) get stripped by renderItemInline. Fall back to a comment-
  // safe wrap that emits each item via f.format — the leaf walker handles
  // hidden-channel placement.
  const itemsHaveComments = hasCommentsInRange(
    f,
    firstItem._start.tokenIndex,
    lastItem._stop!.tokenIndex
  );

  if (!itemsHaveComments) {
    const itemStrs = items.map(it => renderItemInline(f, it));
    const inlineBody = '{' + itemStrs.join(', ') + '} from';
    if (f.o.lineLengthSoFar() + 1 + inlineBody.length <= LINE_BUDGET) {
      f.o.space();
      f.o.text(inlineBody);
      note(f, L.FROM, fromIdx, fromTok);
      return;
    }
    // Wrap form (no comments): one item per line at +1 indent. Pre-rendered
    // text is fine because renderItemInline saw no comments to drop.
    f.o.space();
    f.o.text('{');
    f.o.indent++;
    for (let i = 0; i < itemStrs.length; i++) {
      f.o.nl();
      f.o.text(itemStrs[i]);
      if (i < itemStrs.length - 1) f.o.text(',');
    }
    f.o.indent--;
    f.o.nl();
    f.o.text('} from');
    note(f, L.FROM, fromIdx, fromTok);
    return;
  }

  // Comment-safe wrap: each item emits via f.format so flushHiddenBefore
  // can place its leading/inter-item comments correctly. Trailing `,` after
  // each non-last item, leaf walker turns it into a newline at indent.
  f.o.space();
  f.o.text('{');
  f.o.indent++;
  // Advance past the OCURLY we just emitted manually so the first item's
  // flushHiddenBefore doesn't try to re-emit it.
  f.lastEmittedIdx = ctx._start.tokenIndex;
  for (let i = 0; i < items.length; i++) {
    flushHiddenBefore(f, items[i]._start.tokenIndex);
    f.o.nl();
    f.format(items[i]);
    if (i < items.length - 1) f.o.text(',');
  }
  // Catch any tail comments between the last item and the closing `}`.
  flushHiddenBefore(f, fromIdx);
  f.o.indent--;
  f.o.nl();
  f.o.text('} from');
  note(f, L.FROM, fromIdx, fromTok);
}
