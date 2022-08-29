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
import {
  ExplorePropertiesContext,
  MalloyDocumentContext,
  QueryPropertiesContext,
} from "../lib/Malloy/MalloyParser";
import { MalloyVisitor } from "../lib/Malloy/MalloyVisitor";

export interface DocumentHelpContext {
  type: string;
  token: string | undefined;
}

class HelpContextVisitor
  extends AbstractParseTreeVisitor<DocumentHelpContext | undefined>
  implements MalloyVisitor<DocumentHelpContext | undefined>
{
  type = "";

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

  defaultResult(): DocumentHelpContext | undefined {
    return undefined;
  }

  visitChildren(ctx: ParserRuleContext) {
    let result = this.defaultResult();
    if (this.inRange(this.rangeOf(ctx))) {
      result = {
        type: this.type,
        token: ctx.start.text,
      };
      const n = ctx.childCount;
      for (let i = 0; i < n; i++) {
        const c = ctx.getChild(i);
        const childResult = c.accept(this);
        if (childResult) {
          result = this.aggregateResult(result, childResult);
        }
      }
    }
    return result;
  }

  visitMalloyDocument(
    ctx: MalloyDocumentContext
  ): DocumentHelpContext | undefined {
    if (this.inRange(this.rangeOf(ctx))) {
      this.type = "model_property";
      return this.visitChildren(ctx);
    }
    return this.defaultResult();
  }

  visitExploreProperties(
    ctx: ExplorePropertiesContext
  ): DocumentHelpContext | undefined {
    if (this.inRange(this.rangeOf(ctx))) {
      this.type = "explore_property";
      return this.visitChildren(ctx);
    }
    return this.defaultResult();
  }

  visitQueryProperties(
    ctx: QueryPropertiesContext
  ): DocumentHelpContext | undefined {
    if (this.inRange(this.rangeOf(ctx))) {
      this.type = "query_property";
      return this.visitChildren(ctx);
    }
    return this.defaultResult();
  }

  protected aggregateResult(
    aggregate: DocumentHelpContext | undefined,
    nextResult: DocumentHelpContext | undefined
  ): DocumentHelpContext | undefined {
    return nextResult;
  }
}

export function walkForDocumentHelpContext(
  parseTree: ParseTree,
  position: { line: number; character: number }
): DocumentHelpContext | undefined {
  const visitor = new HelpContextVisitor(position);
  return visitor.visit(parseTree);
}
