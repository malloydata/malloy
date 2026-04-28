/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * RULE: BINARY CHAIN — formatBinaryChain
 *
 * Handles `and`/`or`/`??`/`+`/`-` chains. The grammar is left-recursive, so a
 * chain `a + b + c` parses as `((a + b) + c)`. Only the OUTERMOST chain
 * context emits; inner same-class contexts fall through to default recursion
 * so the outer can collect all operands.
 *
 * Inline if it fits. Otherwise: first operand inline; each subsequent
 * operator+operand on its own line at +1 indent (leading-operator style).
 *
 * We deliberately do NOT break at comparison operators — see prettify header.
 */

import type {ParserRuleContext} from 'antlr4ts';
import type {ParseTree, TerminalNode} from 'antlr4ts/tree';
import type {Formatter} from './formatter';
import {LINE_BUDGET} from './tokens';
import {approxInlineSpan} from './leaf';

export function formatBinaryChain(f: Formatter, ctx: ParserRuleContext): void {
  const ChainCtor = ctx.constructor as Function;
  if (ctx.parent instanceof ChainCtor) {
    // Inner chain — let the outer one emit.
    for (let i = 0; i < ctx.childCount; i++) f.format(ctx.getChild(i));
    return;
  }

  const operands: ParseTree[] = [];
  const operators: TerminalNode[] = [];
  const collect = (n: ParseTree): void => {
    if (n instanceof ChainCtor) {
      const r = n as ParserRuleContext;
      collect(r.getChild(0));
      operators.push(r.getChild(1) as TerminalNode);
      operands.push(r.getChild(2));
    } else {
      operands.push(n);
    }
  };
  collect(ctx);

  const inlineLen = approxInlineSpan(
    f,
    ctx._start.tokenIndex,
    ctx._stop!.tokenIndex
  );
  if (f.o.lineLengthSoFar() + 1 + inlineLen <= LINE_BUDGET) {
    for (let i = 0; i < ctx.childCount; i++) f.format(ctx.getChild(i));
    return;
  }

  f.format(operands[0]);
  f.o.indent++;
  for (let i = 0; i < operators.length; i++) {
    f.o.nl();
    f.format(operators[i]);
    f.format(operands[i + 1]);
  }
  f.o.indent--;
}
