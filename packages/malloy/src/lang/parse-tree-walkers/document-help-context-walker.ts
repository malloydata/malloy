/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { ParserRuleContext } from "antlr4ts";
import { AbstractParseTreeVisitor, ParseTree } from "antlr4ts/tree";
import {
  ExplorePropertiesContext,
  MalloyDocumentContext,
  QueryPropertiesContext,
} from "../lib/Malloy/MalloyParser";
import { MalloyParserVisitor } from "../lib/Malloy/MalloyParserVisitor";

export interface DocumentHelpContext {
  type: string;
  token: string | undefined;
}

class HelpContextVisitor
  extends AbstractParseTreeVisitor<DocumentHelpContext | undefined>
  implements MalloyParserVisitor<DocumentHelpContext | undefined>
{
  type = "";

  constructor(readonly position: { line: number; character: number }) {
    super();
  }

  rangeOf(ctx: ParserRuleContext) {
    const stopToken = ctx.stop || ctx.start;
    return {
      "start": {
        "line": ctx.start.line - 1,
        "character": ctx.start.charPositionInLine,
      },
      "end": {
        "line": stopToken.line - 1,
        "character":
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
        "type": this.type,
        "token": ctx.start.text,
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
