/*
 * Copyright 2021 Google LLC
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

import { CommonTokenStream, ParserRuleContext } from "antlr4ts";
import { ParseTreeWalker } from "antlr4ts/tree/ParseTreeWalker";
import { ParseTree } from "antlr4ts/tree";
import { MalloyListener } from "../lib/Malloy/MalloyListener";
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
];

const MODEL_PROPERTIES = ["explore", "query"];

class DocumentCompletionWalker implements MalloyListener {
  constructor(
    readonly tokens: CommonTokenStream,
    readonly completions: DocumentCompletion[],
    readonly position: { line: number; character: number }
  ) {}

  rangeOf(pcx: ParserRuleContext) {
    const stopToken = pcx.stop || pcx.start;
    return {
      start: {
        line: pcx.start.line - 1,
        character: pcx.start.charPositionInLine,
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
            type: "explore_property",
            text: `${property}: `,
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
            type: "query_property",
            text: `${property}: `,
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
            type: "model_property",
            text: `${property}: `,
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
  const listener: MalloyListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder.completions;
}
