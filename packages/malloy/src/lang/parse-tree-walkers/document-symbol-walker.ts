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

import {CommonTokenStream} from 'antlr4ts';
import {ParseTreeWalker} from 'antlr4ts/tree/ParseTreeWalker';
import {ParseTree} from 'antlr4ts/tree';
import {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
import * as parser from '../lib/Malloy/MalloyParser';
import {DocumentRange} from '../../model/malloy_types';
import {MalloyTranslation} from '../parse-malloy';

export interface DocumentSymbol {
  range: DocumentRange;
  type: string;
  name: string;
  children: DocumentSymbol[];
  lensRange?: DocumentRange;
}

class DocumentSymbolWalker implements MalloyParserListener {
  private blockRange: DocumentRange | undefined;
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

  enterTopLevelQueryDefs(pcx: parser.TopLevelQueryDefsContext) {
    const blockRange = this.translator.rangeFromContext(pcx);
    const defs = pcx.topLevelQueryDef();
    if (defs.length === 1) {
      this.blockRange = blockRange;
    }
  }

  enterTopLevelQueryDef(pcx: parser.TopLevelQueryDefContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(pcx),
      name: pcx.queryName().text,
      type: 'query',
      children: [],
      lensRange: this.blockRange,
    });
    this.blockRange = undefined;
  }

  enterRunStatementDef(pcx: parser.RunStatementDefContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(pcx.topLevelAnonQueryDef()),
      name: 'unnamed_query',
      type: 'unnamed_query',
      children: [],
      lensRange: this.translator.rangeFromContext(pcx),
    });
  }

  enterRunStatementRef(pcx: parser.RunStatementRefContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(pcx.queryName()),
      name: pcx.queryName().id().text,
      type: 'query',
      children: [],
      lensRange: this.translator.rangeFromContext(pcx),
    });
  }

  enterAnonymousQuery(pcx: parser.AnonymousQueryContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(
        pcx.topLevelAnonQueryDef().query()
      ),
      name: 'unnamed_query',
      type: 'unnamed_query',
      children: [],
      lensRange: this.translator.rangeFromContext(pcx),
    });
  }

  enterDefineSourceStatement(pcx: parser.DefineSourceStatementContext) {
    const blockRange = this.translator.rangeFromContext(pcx);
    const sourcePl = pcx.sourcePropertyList();
    const defs = sourcePl.sourceDefinition();
    if (defs.length === 1) {
      this.blockRange = blockRange;
    }
  }

  enterSourceDefinition(pcx: parser.SourceDefinitionContext) {
    const range = this.translator.rangeFromContext(pcx);
    this.scopes.push({
      range,
      name: pcx.sourceNameDef().id().text,
      type: 'explore',
      children: [],
      lensRange: this.blockRange,
    });
    this.blockRange = undefined;
  }

  exitSourceDefinition(_pcx: parser.SourceDefinitionContext) {
    const scope = this.popScope();
    if (scope) {
      this.symbols.push(scope);
    }
  }

  enterDefExploreQuery(pcx: parser.DefExploreQueryContext) {
    const blockRange = this.translator.rangeFromContext(pcx);
    const defs = pcx.subQueryDefList().exploreQueryDef();
    if (defs.length === 1) {
      this.blockRange = blockRange;
    }
  }

  enterExploreQueryDef(pcx: parser.ExploreQueryDefContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.exploreQueryNameDef().id().text,
      type: 'query',
      children: [],
      lensRange: this.blockRange,
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
    this.scopes.push(symbol);
    this.blockRange = undefined;
  }

  exitExploreQueryDef(_pcx: parser.ExploreQueryDefContext) {
    this.popScope();
  }

  handleNestEntry(pcx: parser.NestExistingContext | parser.NestDefContext) {
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: pcx.queryName().id().text,
      type: 'query',
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
      type: 'field',
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterQueryFieldEntry(pcx: parser.QueryFieldEntryContext) {
    const fieldRef = pcx.taggedRef()?.fieldPath();
    if (fieldRef === undefined) return;
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: fieldRef.text,
      type: 'field',
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
      type: 'field',
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
      type: 'join',
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterDefineSQLStatement(pcx: parser.DefineSQLStatementContext) {
    const name = pcx.nameSQLBlock().text;
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name: name,
      type: 'sql',
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
