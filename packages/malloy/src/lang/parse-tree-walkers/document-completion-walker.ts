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

import { CommonTokenStream, ParserRuleContext } from "antlr4ts";
import { ParseTreeWalker } from "antlr4ts/tree/ParseTreeWalker";
import { ParseTree } from "antlr4ts/tree";
import { MalloyParserListener } from "../lib/Malloy/MalloyParserListener";
import * as parser from "../lib/Malloy/MalloyParser";

export interface DocumentCompletion {
  type: string;
  text: string;
}

const EXPLORE_PROPERTIES = [
  "dimension",
  "measure",
  "join_one",
  "join_many",
  "join_cross",
  "where",
  "primary_key",
  "rename",
  "accept",
  "except",
  "query",
  "declare",
];

const QUERY_PROPERTIES = [
  "group_by",
  "project",
  "index",
  "aggregate",
  "top",
  "limit",
  "order_by",
  "where",
  "having",
  "nest",
  "declare",
];

const MODEL_PROPERTIES = ["source", "explore", "query", "sql"];

class DocumentCompletionWalker implements MalloyParserListener {
  constructor(
    readonly tokens: CommonTokenStream,
    readonly completions: DocumentCompletion[],
    readonly position: { line: number; character: number }
  ) {}

  rangeOf(pcx: ParserRuleContext) {
    const stopToken = pcx.stop || pcx.start;
    return {
      "start": {
        "line": pcx.start.line - 1,
        "character": pcx.start.charPositionInLine,
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
    const { start, end } = range;
    const afterStart =
      this.position.line > start.line ||
      (this.position.line === start.line &&
        this.position.character >= start.character);
    const beforeEnd =
      this.position.line < end.line ||
      (this.position.line === end.line &&
        this.position.character <= end.character);
    return afterStart && beforeEnd;
  }

  enterExploreProperties(ctx: parser.ExplorePropertiesContext) {
    if (this.inRange(this.rangeOf(ctx))) {
      let insideStatement = false;
      for (const exploreStatementContext of ctx.exploreStatement()) {
        if (this.inRange(this.rangeOf(exploreStatementContext))) {
          insideStatement = true;
        }
      }
      if (!insideStatement) {
        for (const property of EXPLORE_PROPERTIES) {
          this.completions.push({
            "type": "explore_property",
            "text": `${property}: `,
          });
        }
      }
    }
  }

  enterQueryProperties(ctx: parser.QueryPropertiesContext) {
    if (this.inRange(this.rangeOf(ctx))) {
      let insideStatement = false;
      for (const exploreStatementContext of ctx.queryStatement()) {
        if (this.inRange(this.rangeOf(exploreStatementContext))) {
          insideStatement = true;
        }
      }
      if (!insideStatement) {
        for (const property of QUERY_PROPERTIES) {
          this.completions.push({
            "type": "query_property",
            "text": `${property}: `,
          });
        }
      }
    }
  }

  enterMalloyDocument(ctx: parser.MalloyDocumentContext) {
    if (this.inRange(this.rangeOf(ctx))) {
      let insideStatement = false;
      for (const modelStatementContext of ctx.malloyStatement()) {
        if (this.inRange(this.rangeOf(modelStatementContext))) {
          insideStatement = true;
        }
      }
      if (!insideStatement) {
        for (const property of MODEL_PROPERTIES) {
          this.completions.push({
            "type": "model_property",
            "text": `${property}: `,
          });
        }
      }
    }
  }
}

export function walkForDocumentCompletions(
  tokens: CommonTokenStream,
  parseTree: ParseTree,
  position: { line: number; character: number }
): DocumentCompletion[] {
  const finder = new DocumentCompletionWalker(tokens, [], position);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder.completions;
}
