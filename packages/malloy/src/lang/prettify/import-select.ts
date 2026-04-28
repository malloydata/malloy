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
import {note} from './leaf';
import {renderItemInline} from './inline-renderer';

export function formatImportSelect(
  f: Formatter,
  ctx: parser.ImportSelectContext
): void {
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
  const itemStrs = items.map(it => renderItemInline(f, it));
  const inlineBody = '{' + itemStrs.join(', ') + '} from';
  if (f.o.lineLengthSoFar() + 1 + inlineBody.length <= LINE_BUDGET) {
    f.o.space();
    f.o.text(inlineBody);
    note(f, L.FROM, fromIdx, fromTok);
    return;
  }
  // Wrap form: one item per line at +1 indent.
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
}
