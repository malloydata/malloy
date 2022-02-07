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

export interface DocumentSymbol {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  type: string;
  name: string;
  children: DocumentSymbol[];
}

class DocumentSymbolWalker implements MalloyListener {
  constructor(
    readonly tokens: CommonTokenStream,
    readonly scopes: DocumentSymbol[],
    readonly symbols: DocumentSymbol[]
  ) {}

  popScope(): DocumentSymbol | undefined {
    return this.scopes.pop();
  }

  peekScope(): DocumentSymbol | undefined {
    return this.scopes[this.scopes.length - 1];
  }

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

  enterTopLevelQueryDef(pcx: parser.TopLevelQueryDefContext) {
    this.symbols.push({
      range: this.rangeOf(pcx),
      name: pcx.queryName().text,
      type: "query",
      children: [],
    });
  }

  enterAnonymousQuery(pcx: parser.AnonymousQueryContext) {
    this.symbols.push({
      range: this.rangeOf(pcx),
      name: "unnamed_query",
      type: "unnamed_query",
      children: [],
    });
  }

  enterExploreDefinition(pcx: parser.ExploreDefinitionContext) {
    this.scopes.push({
      range: this.rangeOf(pcx),
      name: pcx.exploreNameDef().id().text,
      type: "explore",
      children: [],
    });
  }

  exitExploreDefinition(_pcx: parser.ExploreDefinitionContext) {
    const scope = this.popScope();
    if (scope) {
      this.symbols.push(scope);
    }
  }

  enterExploreQueryDef(pcx: parser.ExploreQueryDefContext) {
    const symbol = {
      range: this.rangeOf(pcx),
      name: pcx.exploreQueryNameDef().id().text,
      type: "query",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
    this.scopes.push(symbol);
  }

  exitExploreQueryDef(_pcx: parser.ExploreQueryDefContext) {
    this.popScope();
  }

  enterDimensionDef(pcx: parser.DimensionDefContext) {
    const symbol = {
      range: this.rangeOf(pcx),
      name: pcx.fieldDef().fieldNameDef().id().text,
      type: "field",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterMeasureDef(pcx: parser.MeasureDefContext) {
    const symbol = {
      range: this.rangeOf(pcx),
      name: pcx.fieldDef().fieldNameDef().id().text,
      type: "field",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterDefExploreRename(pcx: parser.DefExploreRenameContext) {
    const symbol = {
      range: this.rangeOf(pcx),
      name: pcx.fieldName()[0].text,
      type: "field",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterJoinNameDef(pcx: parser.JoinNameDefContext) {
    const symbol = {
      range: this.rangeOf(pcx),
      name: pcx.id().text,
      type: "join",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterDefineSQLStatement(pcx: parser.DefineSQLStatementContext) {
    const name = pcx.sqlCommandNameDef()?.id().text;
    const symbol = {
      range: this.rangeOf(pcx),
      name: name || "unnamed_sql",
      type: name === undefined ? "unnamed_sql" : "sql",
      children: [],
    };
    this.symbols.push(symbol);
  }
}

export function walkForDocumentSymbols(
  tokens: CommonTokenStream,
  parseTree: ParseTree
): DocumentSymbol[] {
  const finder = new DocumentSymbolWalker(tokens, [], []);
  const listener: MalloyListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder.symbols;
}
