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

import { TextDocument } from "vscode-languageserver-textdocument";
import { HighlightType, Malloy } from "@malloy-lang/malloy";
import {
  SemanticTokens,
  SemanticTokensBuilder,
} from "vscode-languageserver/node";

export const TOKEN_TYPES = [
  "class",
  "interface",
  "enum",
  "function",
  "variable",
  "keyword",
  "number",
  "string",
  "comment",
  "type",
  "regexp",
  "macro",
  "property.readonly",
  "label",
  "enumMember",
  "operator",
];

export const TOKEN_MODIFIERS = ["declaration", "documentation"];

export function getMalloyHighlights(document: TextDocument): SemanticTokens {
  const tokensBuilder = new SemanticTokensBuilder();

  const text = document.getText();
  const textLines = text.split("\n");
  const parse = Malloy.parse(text);

  const highlights = parse.getHighlights();

  highlights.forEach((highlight) => {
    for (
      let line = highlight.getRange().getStart().getLine();
      line <= highlight.getRange().getEnd().getLine();
      line++
    ) {
      const lineText = textLines[line];
      let length;
      let start;
      if (
        highlight.getRange().getStart().getLine() ===
        highlight.getRange().getEnd().getLine()
      ) {
        length =
          highlight.getRange().getEnd().getCharacter() -
          highlight.getRange().getStart().getCharacter();
        start = highlight.getRange().getStart().getCharacter();
      } else if (line === highlight.getRange().getStart().getLine()) {
        length =
          lineText.length - highlight.getRange().getStart().getCharacter();
        start = highlight.getRange().getStart().getCharacter();
      } else if (line === highlight.getRange().getEnd().getLine()) {
        length = highlight.getRange().getEnd().getCharacter();
        start = 0;
      } else {
        length = lineText.length;
        start = 0;
      }
      tokensBuilder.push(
        line,
        start,
        length,
        TOKEN_TYPES.indexOf(mapTypes(highlight.getType())),
        0
      );
    }
  });

  return tokensBuilder.build();
}

function mapTypes(type: string) {
  switch (type) {
    case HighlightType.Identifier:
      return "variable";
    case HighlightType.Call.Aggregate:
    case HighlightType.Keyword.AggregateModifier.Distinct:
      return "macro";
    case HighlightType.Type:
      return "type";
    case HighlightType.Keyword.Explore:
    case HighlightType.Keyword.Is:
    case HighlightType.Keyword.Top:
    case HighlightType.Keyword.Order:
    case HighlightType.Keyword.By:
    case HighlightType.Keyword.Limit:
    case HighlightType.Keyword.Join:
    case HighlightType.Keyword.On:
    case HighlightType.Keyword.Primary:
    case HighlightType.Keyword.Key:
    case HighlightType.Keyword.Renames:
    case HighlightType.Keyword.Define:
    case HighlightType.Keyword.Export:
    case HighlightType.Keyword.Desc:
    case HighlightType.Keyword.Asc:
    case HighlightType.Call.Cast:
    case HighlightType.Keyword.CastModifier.As:
    case HighlightType.Keyword.Pick:
    case HighlightType.Keyword.When:
    case HighlightType.Keyword.Else:
    case HighlightType.Keyword.Accept:
    case HighlightType.Keyword.Except:
    case HighlightType.Keyword.Import:
      return "keyword";
    // These are more like meta types, so maybe they should be highlighted differently
    case HighlightType.Keyword.JSON:
    case HighlightType.Keyword.Turtle:
      return "keyword";
    case HighlightType.Call.TimeFrame:
      return "macro";
    case HighlightType.Literal.String:
      return "string";
    case HighlightType.Literal.Boolean:
      return "enumMember";
    case HighlightType.Literal.Null:
      return "keyword";
    case HighlightType.Literal.Number:
      return "number";
    case HighlightType.Literal.RegularExpression:
      return "regexp";
    case HighlightType.Literal.Date:
      return "number";
    case HighlightType.Transformation.Reduce:
    case HighlightType.Transformation.Project:
    case HighlightType.Transformation.Index:
      return "keyword";
    case HighlightType.Label.Fields:
    case HighlightType.Label.Joins:
      return "label";
    case HighlightType.Operator.Comparison:
      return "operator";
    case HighlightType.Operator.Boolean:
      return "keyword";
    case HighlightType.Operator.Date:
      return "keyword";
    case HighlightType.Comment.Line:
    case HighlightType.Comment.Block:
      return "comment";
    default:
      throw new Error(`Unexpected type ${type}`);
  }
}
