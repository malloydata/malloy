/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { ParserRuleContext } from "antlr4ts";
import { AbstractParseTreeVisitor, ParseTree } from "antlr4ts/tree";
import { MalloyParser } from "../lib/Malloy/MalloyParser";
import { MalloyVisitor } from "../lib/Malloy/MalloyVisitor";

export interface DocumentHelpContext {
  type: string;
  token: string | undefined;
}

export interface DocumentHelpWalk {
  type: number;
  token: string | undefined;
}

class HelpContextVisitor
  extends AbstractParseTreeVisitor<DocumentHelpWalk[]>
  implements MalloyVisitor<DocumentHelpWalk[]>
{
  constructor(readonly position: { line: number; character: number }) {
    super();
  }

  rangeOf(ctx: ParserRuleContext) {
    const stopToken = ctx.stop || ctx.start;
    return {
      start: {
        line: ctx.start.line - 1,
        character: ctx.start.charPositionInLine,
      },
      end: {
        line: stopToken.line - 1,
        character:
          stopToken.stopIndex -
          (stopToken.startIndex - stopToken.charPositionInLine) +
          1,
      },
    };
  }

  inRange(range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  }): boolean {
    return (
      range.start.line <= this.position.line &&
      range.end.line >= this.position.line &&
      (this.position.line !== range.start.line ||
        this.position.character >= range.start.character) &&
      (this.position.line !== range.end.line ||
        this.position.character <= range.end.character)
    );
  }

  defaultResult(): DocumentHelpWalk[] {
    return [];
  }

  visitChildren(ctx: ParserRuleContext) {
    let result = this.defaultResult();
    if (this.inRange(this.rangeOf(ctx))) {
      result = [
        {
          type: ctx.ruleIndex,
          token: ctx.start.text,
        },
      ];
      const n = ctx.childCount;
      for (let i = 0; i < n; i++) {
        const c = ctx.getChild(i);
        const childResult = c.accept(this);
        if (childResult.length) {
          result = this.aggregateResult(result, childResult);
        }
      }
    }
    return result;
  }

  protected aggregateResult(
    aggregate: DocumentHelpWalk[],
    nextResult: DocumentHelpWalk[]
  ): DocumentHelpWalk[] {
    return aggregate.concat(nextResult);
  }
}

export function walkForDocumentHelpContext(
  parseTree: ParseTree,
  position: { line: number; character: number }
): DocumentHelpContext | undefined {
  const visitor = new HelpContextVisitor(position);
  const context = visitor.visit(parseTree);

  if (context.length) {
    const token = context[context.length - 1].token;
    let type = "model_property";
    for (let idx = 0; idx < context.length - 1; idx++) {
      if (context[idx].type === MalloyParser.RULE_exploreProperties) {
        type = "explore_property";
      } else if (context[idx].type === MalloyParser.RULE_queryProperties) {
        type = "query_property";
      }
    }
    return {
      type,
      token,
    };
  }
  return undefined;
}
