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
import { ParseTreeWalker } from "antlr4ts/tree/ParseTreeWalker";
import { ParseTree } from "antlr4ts/tree";
import { MalloyParserListener } from "../lib/Malloy/MalloyParserListener";
import * as parser from "../lib/Malloy/MalloyParser";
import { DocumentRange } from "../../model/malloy_types";
import { MalloyTranslation } from "../parse-malloy";

export interface DocumentSymbol {
  range: DocumentRange;
  type: string;
  name: string;
  children: DocumentSymbol[];
}

class DocumentSymbolWalker implements MalloyParserListener {
  constructor(
    readonly translator: MalloyTranslation,
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

  enterTopLevelQueryDef(pcx: parser.TopLevelQueryDefContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(pcx),
      name: pcx.queryName().text,
      type: "query",
      children: [],
    });
  }

  enterTopLevelAnonQueryDef(pcx: parser.TopLevelAnonQueryDefContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(pcx),
      name: "unnamed_query",
      type: "unnamed_query",
      children: [],
    });
  }

  enterExploreDefinition(pcx: parser.ExploreDefinitionContext) {
    this.scopes.push({
      range: this.translator.rangeFromContext(pcx),
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
      range: this.translator.rangeFromContext(pcx),
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

  handleNestEntry(pcx: parser.NestExistingContext | parser.NestDefContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.queryName().id().text,
      type: "query",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
    return symbol;
  }

  enterNestExisting(pcx: parser.NestExistingContext) {
    this.handleNestEntry(pcx);
  }

  enterNestDef(pcx: parser.NestDefContext) {
    const symbol = this.handleNestEntry(pcx);
    this.scopes.push(symbol);
  }

  exitNestDef(_pcx: parser.NestDefContext) {
    this.popScope();
  }

  enterFieldDef(pcx: parser.FieldDefContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.fieldNameDef().id().text,
      type: "field",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterQueryFieldRef(pcx: parser.QueryFieldRefContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.fieldPath().text,
      type: "field",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterExploreRenameDef(pcx: parser.ExploreRenameDefContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.fieldName()[0].text,
      type: "field",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterJoinWith(pcx: parser.JoinWithContext) {
    this.handleJoinDef(pcx);
  }

  enterJoinOn(pcx: parser.JoinOnContext) {
    this.handleJoinDef(pcx);
  }

  handleJoinDef(pcx: parser.JoinWithContext | parser.JoinOnContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.joinNameDef().id().text,
      type: "join",
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterSqlStatementDef(pcx: parser.SqlStatementDefContext) {
    const name = pcx.sqlCommandNameDef()?.id().text;
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: name || "unnamed_sql",
      type: name === undefined ? "unnamed_sql" : "sql",
      children: [],
    };
    this.symbols.push(symbol);
  }
}

export function walkForDocumentSymbols(
  forParse: MalloyTranslation,
  tokens: CommonTokenStream,
  parseTree: ParseTree
): DocumentSymbol[] {
  const finder = new DocumentSymbolWalker(forParse, tokens, [], []);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder.symbols;
}
