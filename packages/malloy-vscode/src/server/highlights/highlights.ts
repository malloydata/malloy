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
import { HighlightType, Malloy } from "@malloydata/malloy";
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

export function stubMalloyHighlights(_document: TextDocument): SemanticTokens {
  return new SemanticTokensBuilder().build();
}

// TODO Currently semantic highlights are disabled. Either remove `getMalloyHighlights`
//      or call it instead of `stubMalloyHighlights`.
export function getMalloyHighlights(document: TextDocument): SemanticTokens {
  const tokensBuilder = new SemanticTokensBuilder();

  const text = document.getText();
  const textLines = text.split("\n");
  const parse = Malloy.parse({ source: text });

  parse.highlights.forEach((highlight) => {
    for (
      let line = highlight.range.start.line;
      line <= highlight.range.end.line;
      line++
    ) {
      const lineText = textLines[line];
      let length;
      let start;
      if (highlight.range.start.line === highlight.range.end.line) {
        length =
          highlight.range.end.character - highlight.range.start.character;
        start = highlight.range.start.character;
      } else if (line === highlight.range.start.line) {
        length = lineText.length - highlight.range.start.character;
        start = highlight.range.start.character;
      } else if (line === highlight.range.end.line) {
        length = highlight.range.end.character;
        start = 0;
      } else {
        length = lineText.length;
        start = 0;
      }
      tokensBuilder.push(
        line,
        start,
        length,
        TOKEN_TYPES.indexOf(mapTypes(highlight.type)),
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
      return "function";
    case HighlightType.Type:
      return "type";
    case HighlightType.Keyword.Is:
    case HighlightType.Keyword.With:
    case HighlightType.Keyword.On:
    case HighlightType.Keyword.Desc:
    case HighlightType.Keyword.Asc:
    case HighlightType.Call.Cast:
    case HighlightType.Keyword.CastModifier.As:
    case HighlightType.Keyword.Pick:
    case HighlightType.Keyword.When:
    case HighlightType.Keyword.Else:
    case HighlightType.Keyword.Import:
      return "keyword";
    // These are more like meta types, so maybe they should be highlighted differently
    case HighlightType.Keyword.JSON:
    case HighlightType.Keyword.Turtle:
      return "keyword";
    case HighlightType.Call.TimeFrame:
      return "variable";
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
    case HighlightType.Operator.Comparison:
      return "operator";
    case HighlightType.Operator.Boolean:
      return "keyword";
    case HighlightType.Operator.Date:
      return "keyword";
    case HighlightType.Comment.Line:
    case HighlightType.Comment.Block:
      return "comment";
    case HighlightType.Property.Accept:
    case HighlightType.Property.Aggregate:
    case HighlightType.Property.Dimension:
    case HighlightType.Property.Except:
    case HighlightType.Property.Explore:
    case HighlightType.Property.GroupBy:
    case HighlightType.Property.Having:
    case HighlightType.Property.Index:
    case HighlightType.Property.JoinOne:
    case HighlightType.Property.JoinMany:
    case HighlightType.Property.JoinCross:
    case HighlightType.Property.Limit:
    case HighlightType.Property.Measure:
    case HighlightType.Property.Nest:
    case HighlightType.Property.OrderBy:
    case HighlightType.Property.PrimaryKey:
    case HighlightType.Property.Project:
    case HighlightType.Property.Query:
    case HighlightType.Property.Rename:
    case HighlightType.Property.Top:
    case HighlightType.Property.Where:
    case HighlightType.Property.SQL:
      return "keyword";
    case HighlightType.Call.Table:
    case HighlightType.Call.From:
    case HighlightType.Call.FromSQL:
    case HighlightType.Call.Function:
      return "function";
    default:
      throw new Error(`Unexpected type ${type}`);
  }
}
