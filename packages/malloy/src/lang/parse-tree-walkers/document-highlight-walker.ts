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
import { MalloyParser } from "../lib/Malloy/MalloyParser";
import { Token } from "antlr4ts/Token";
import { DocumentRange } from "../../model/malloy_types";

export interface DocumentHighlight {
  range: DocumentRange;
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
    Table: "call.table",
    From: "call.from",
    Function: "call.function",
    FromSQL: "call.from_sql",
  },
  // TODO many of these should probably be categorized further
  Keyword: {
    AggregateModifier: {
      Distinct: "keyword.aggregate_modifier.distinct",
    },
    CastModifier: {
      As: "keyword.cast_modifier.as",
    },
    Is: "keyword.is",
    On: "keyword.on",
    Desc: "keyword.desc",
    Asc: "keyword.asc",
    Pick: "keyword.pick",
    When: "keyword.when",
    Else: "keyword.else",
    With: "keyword.with",
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
  Comment: {
    Line: "comment.line",
    Block: "comment.block",
  },
  Property: {
    Accept: "property.accept",
    Aggregate: "property.aggregate",
    Dimension: "property.dimension",
    Except: "property.except",
    Explore: "property.explore",
    Source: "property.source",
    GroupBy: "property.group_by",
    Having: "property.having",
    Index: "property.index",
    JoinOne: "keyword.join_one",
    JoinMany: "keyword.join_many",
    JoinCross: "keyword.join_cross",
    Limit: "property.limit",
    Measure: "property.measure",
    Nest: "property.nest",
    OrderBy: "property.order_by",
    PrimaryKey: "property.primary_key",
    Project: "property.project",
    Query: "property.query",
    Rename: "property.rename",
    Top: "property.top",
    Where: "property.where",
    SQL: "property.sql",
  },
};

export function passForHighlights(
  tokens: CommonTokenStream
): DocumentHighlight[] {
  const highlights: DocumentHighlight[] = [];
  const register = (token: Token, type: string, removeColon = false) => {
    const offset = token.startIndex - token.charPositionInLine;
    const tokenLines = token.text?.split("\n") || [];
    const numberOfLines = tokenLines.length;
    const lengthOfAllButLastLine = tokenLines
      .slice(0, -1)
      .reduce((a, l) => a + l.length, 0);
    const colonAdjustment = removeColon ? 1 : 0;
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
            numberOfLines -
            colonAdjustment,
        },
      },
    });
  };
  for (let i = 0; i < tokens.size; i++) {
    const token = tokens.get(i);

    switch (token.type) {
      case MalloyParser.ACCEPT:
        register(token, HighlightType.Property.Accept, true);
        break;
      case MalloyParser.AGGREGATE:
        register(token, HighlightType.Property.Aggregate, true);
        break;
      case MalloyParser.DIMENSION:
        register(token, HighlightType.Property.Dimension, true);
        break;
      case MalloyParser.EXCEPT:
        register(token, HighlightType.Property.Except, true);
        break;
      case MalloyParser.EXPLORE:
        register(token, HighlightType.Property.Explore, true);
        break;
      case MalloyParser.GROUP_BY:
        register(token, HighlightType.Property.GroupBy, true);
        break;
      case MalloyParser.HAVING:
        register(token, HighlightType.Property.Having, true);
        break;
      case MalloyParser.INDEX:
        register(token, HighlightType.Property.Index, true);
        break;
      case MalloyParser.JOIN_CROSS:
        register(token, HighlightType.Property.JoinOne, true);
        break;
      case MalloyParser.JOIN_ONE:
        register(token, HighlightType.Property.JoinMany, true);
        break;
      case MalloyParser.JOIN_MANY:
        register(token, HighlightType.Property.JoinCross, true);
        break;
      case MalloyParser.LIMIT:
        register(token, HighlightType.Property.Limit, true);
        break;
      case MalloyParser.MEASURE:
        register(token, HighlightType.Property.Measure, true);
        break;
      case MalloyParser.NEST:
        register(token, HighlightType.Property.Nest, true);
        break;
      case MalloyParser.ORDER_BY:
        register(token, HighlightType.Property.OrderBy, true);
        break;
      case MalloyParser.PRIMARY_KEY:
        register(token, HighlightType.Property.PrimaryKey, true);
        break;
      case MalloyParser.PROJECT:
        register(token, HighlightType.Property.Project, true);
        break;
      case MalloyParser.QUERY:
        register(token, HighlightType.Property.Query, true);
        break;
      case MalloyParser.RENAME:
        register(token, HighlightType.Property.Rename, true);
        break;
      case MalloyParser.TOP:
        register(token, HighlightType.Property.Top, true);
        break;
      case MalloyParser.WHERE:
        register(token, HighlightType.Property.Where, true);
        break;
      case MalloyParser.SQL:
        register(token, HighlightType.Property.SQL, true);
        break;
      case MalloyParser.TABLE:
        register(token, HighlightType.Call.Table);
        break;
      case MalloyParser.FROM:
        register(token, HighlightType.Call.From);
        break;
      case MalloyParser.FROM_SQL:
        register(token, HighlightType.Call.FromSQL);
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
      case MalloyParser.IS:
        register(token, HighlightType.Keyword.Is);
        break;
      case MalloyParser.DISTINCT:
        register(token, HighlightType.Keyword.AggregateModifier.Distinct);
        break;
      case MalloyParser.ON:
        register(token, HighlightType.Keyword.On);
        break;
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
      case MalloyParser.WITH:
        register(token, HighlightType.Keyword.With);
        break;
      case MalloyParser.ELSE:
        register(token, HighlightType.Keyword.Else);
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

class DocumentHighlightWalker implements MalloyListener {
  constructor(
    readonly tokens: CommonTokenStream,
    readonly highlights: DocumentHighlight[]
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

  enterExprFunc(pcx: parser.ExprFuncContext) {
    const id = pcx.id() || pcx.timeframe();
    if (id) {
      this.highlights.push({
        range: this.rangeOf(id),
        type: HighlightType.Call.Function,
      });
    }
  }
}

export function walkForDocumentHighlights(
  tokens: CommonTokenStream,
  parseTree: ParseTree
): DocumentHighlight[] {
  const finder = new DocumentHighlightWalker(tokens, []);
  const listener: MalloyListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder.highlights;
}

export function sortHighlights(
  highlights: DocumentHighlight[]
): DocumentHighlight[] {
  return highlights.sort((a, b) => {
    if (a.range.start.line < b.range.start.line) {
      return -1;
    } else if (a.range.start.line > b.range.start.line) {
      return 1;
    } else if (a.range.start.character < b.range.start.character) {
      return -1;
    } else if (a.range.start.character > b.range.start.character) {
      return 1;
    } else {
      return 0;
    }
  });
}
