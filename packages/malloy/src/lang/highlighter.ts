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

import { CommonTokenStream } from "antlr4ts";
import { Token } from "antlr4ts/Token";
import { MalloyParser } from "./lib/Malloy/MalloyParser";

export interface DocumentHighlight {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  type: string;
}

// TODO maybe this could be an enum like Definition__Field, etc.
export const HighlightType = {
  Identifier: "identifier",
  Type: "type",
  Literal: {
    Date: "literal.date",
    Number: "literal.number",
    String: "literal.string",
    RegularExpression: "literal.regular_expression",
    Boolean: "literal.boolean",
    Null: "literal.null",
  },
  Call: {
    Aggregate: "call.aggregate",
    TimeFrame: "call.time_frame",
    Cast: "call.cast",
  },
  // TODO many of these should probably be categorized further
  Keyword: {
    AggregateModifier: {
      Distinct: "keyword.aggregate_modifier.distinct",
    },
    CastModifier: {
      As: "keyword.cast_modifier.as",
    },
    Explore: "keyword.explore",
    Is: "keyword.is",
    Top: "keyword.top",
    // TODO should "order" parse as a keyword if it is not followed by "by"
    Order: "keyword.order",
    By: "keyword.by",
    Limit: "keyword.limit",
    Join: "keyword.join",
    On: "keyword.on",
    Renames: "keyword.renames",
    // TODO should "primary" or "key" parse as keywords if not together?
    Primary: "keyword.primary",
    Key: "keyword.key",
    Export: "keyword.export",
    Define: "keyword.define",
    Desc: "keyword.desc",
    Asc: "keyword.asc",
    Pick: "keyword.pick",
    When: "keyword.when",
    Else: "keyword.else",
    Accept: "keyword.accept",
    Except: "keyword.except",
    // TODO or is this a meta type?
    JSON: "keyword.json",
    // TODO or is this a meta type?
    Turtle: "keyword.turtle",
    Import: "keyword.import",
  },
  Operator: {
    Comparison: "operator.comparison",
    Boolean: "operator.boolean",
    Date: "operator.date",
  },
  Transformation: {
    Reduce: "transformation.reduce",
    Index: "transformation.index",
    Project: "transformation.project",
  },
  Label: {
    Fields: "label.fields",
    Joins: "label.joins",
  },
  Comment: {
    Line: "comment.line",
    Block: "comment.block",
  },
};

export function passForHighlights(
  tokens: CommonTokenStream
): DocumentHighlight[] {
  const highlights: DocumentHighlight[] = [];
  const register = (token: Token, type: string) => {
    const offset = token.startIndex - token.charPositionInLine;
    const tokenLines = token.text?.split("\n") || [];
    const numberOfLines = tokenLines.length;
    const lengthOfAllButLastLine = tokenLines
      .slice(0, -1)
      .reduce((a, l) => a + l.length, 0);
    highlights.push({
      type,
      range: {
        start: { line: token.line - 1, character: token.startIndex - offset },
        end: {
          line: token.line - 1 + numberOfLines - 1,
          character:
            token.stopIndex +
            2 -
            (numberOfLines > 1 ? token.startIndex : offset) -
            lengthOfAllButLastLine -
            numberOfLines,
        },
      },
    });
  };
  for (let i = 0; i < tokens.size; i++) {
    const token = tokens.get(i);

    switch (token.type) {
      case MalloyParser.EXPLORE:
        register(token, HighlightType.Keyword.Explore);
        break;
      case MalloyParser.STRING_LITERAL:
      case MalloyParser.JSON_STRING:
        register(token, HighlightType.Literal.String);
        break;
      case MalloyParser.NUMERIC_LITERAL:
      case MalloyParser.INTEGER_LITERAL:
        register(token, HighlightType.Literal.Number);
        break;
      case MalloyParser.HACKY_REGEX:
        register(token, HighlightType.Literal.RegularExpression);
        break;
      // case MalloyParser.REDUCE:
      //   register(token, HighlightType.Transformation.Reduce);
      //   break;
      case MalloyParser.PROJECT:
        register(token, HighlightType.Transformation.Project);
        break;
      case MalloyParser.INDEX:
        register(token, HighlightType.Transformation.Index);
        break;
      case MalloyParser.IS:
        register(token, HighlightType.Keyword.Is);
        break;
      case MalloyParser.TOP:
        register(token, HighlightType.Keyword.Top);
        break;
      // case MalloyParser.ORDER:
      //   register(token, HighlightType.Keyword.Order);
      //   break;
      case MalloyParser.BY:
        register(token, HighlightType.Keyword.By);
        break;
      case MalloyParser.LIMIT:
        register(token, HighlightType.Keyword.Limit);
        break;
      case MalloyParser.DISTINCT:
        register(token, HighlightType.Keyword.AggregateModifier.Distinct);
        break;
      // case MalloyParser.FIELDS:
      //   register(token, HighlightType.Label.Fields);
      //   break;
      // case MalloyParser.JOINS:
      //   register(token, HighlightType.Label.Joins);
      //   break;
      case MalloyParser.JOIN:
        register(token, HighlightType.Keyword.Join);
        break;
      case MalloyParser.ON:
        register(token, HighlightType.Keyword.On);
        break;
      // case MalloyParser.RENAMES:
      //   register(token, HighlightType.Keyword.Renames);
      //   break;
      // case MalloyParser.PRIMARY:
      //   register(token, HighlightType.Keyword.Primary);
      //   break;
      // case MalloyParser.KEY:
      //   register(token, HighlightType.Keyword.Key);
      //   break;
      // case MalloyParser.DEFINE:
      //   register(token, HighlightType.Keyword.Define);
      //   break;
      // case MalloyParser.EXPORT:
      //   register(token, HighlightType.Keyword.Export);
      //   break;
      case MalloyParser.DESC:
        register(token, HighlightType.Keyword.Desc);
        break;
      case MalloyParser.ASC:
        register(token, HighlightType.Keyword.Asc);
        break;
      case MalloyParser.CAST:
        register(token, HighlightType.Call.Cast);
        break;
      case MalloyParser.AS:
        register(token, HighlightType.Keyword.CastModifier.As);
        break;
      case MalloyParser.PICK:
        register(token, HighlightType.Keyword.Pick);
        break;
      case MalloyParser.WHEN:
        register(token, HighlightType.Keyword.When);
        break;
      case MalloyParser.ELSE:
        register(token, HighlightType.Keyword.Else);
        break;
      case MalloyParser.ACCEPT:
        register(token, HighlightType.Keyword.Accept);
        break;
      case MalloyParser.EXCEPT:
        register(token, HighlightType.Keyword.Except);
        break;
      case MalloyParser.JSON:
        register(token, HighlightType.Keyword.JSON);
        break;
      case MalloyParser.TURTLE:
        register(token, HighlightType.Keyword.Turtle);
        break;
      case MalloyParser.TRUE:
      case MalloyParser.FALSE:
        register(token, HighlightType.Literal.Boolean);
        break;
      case MalloyParser.NOW:
      case MalloyParser.LITERAL_TIMESTAMP:
      case MalloyParser.LITERAL_QUARTER:
      case MalloyParser.LITERAL_MONTH:
      case MalloyParser.LITERAL_DAY:
      case MalloyParser.LITERAL_WEEK:
      case MalloyParser.LITERAL_YEAR:
        register(token, HighlightType.Literal.Date);
        break;
      case MalloyParser.NULL:
        register(token, HighlightType.Literal.Null);
        break;
      case MalloyParser.AND:
      case MalloyParser.OR:
      case MalloyParser.NOT:
        register(token, HighlightType.Operator.Boolean);
        break;
      case MalloyParser.FOR:
        register(token, HighlightType.Operator.Date);
        break;
      case MalloyParser.COMMENT_TO_EOL:
        register(token, HighlightType.Comment.Line);
        break;
      case MalloyParser.BLOCK_COMMENT:
        register(token, HighlightType.Comment.Block);
        break;
      case MalloyParser.SUM:
      case MalloyParser.COUNT:
      case MalloyParser.AVG:
      case MalloyParser.MIN:
      case MalloyParser.MAX:
        register(token, HighlightType.Call.Aggregate);
        break;
      case MalloyParser.IDENTIFIER:
      case MalloyParser.OBJECT_NAME_LITERAL:
        register(token, HighlightType.Identifier);
        break;
      case MalloyParser.STRING:
      case MalloyParser.NUMBER:
      case MalloyParser.BOOLEAN:
      case MalloyParser.DATE:
      case MalloyParser.TIMESTAMP:
        register(token, HighlightType.Type);
        break;
      case MalloyParser.SECOND:
      case MalloyParser.MINUTE:
      case MalloyParser.HOUR:
      case MalloyParser.DAY:
      case MalloyParser.WEEK:
      case MalloyParser.MONTH:
      case MalloyParser.QUARTER:
      case MalloyParser.YEAR:
        register(token, HighlightType.Call.TimeFrame);
        break;
      case MalloyParser.IMPORT:
        register(token, HighlightType.Keyword.Import);
        break;

      // TODO durations? How should we highlight `3 days` or
      //      `(1 + 2) days` or `n days`?
    }
  }
  return highlights;
}
