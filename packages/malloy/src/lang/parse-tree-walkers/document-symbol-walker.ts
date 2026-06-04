/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CommonTokenStream} from 'antlr4ts';
import {ParseTreeWalker} from 'antlr4ts/tree/ParseTreeWalker';
import type {ParseTree} from 'antlr4ts/tree';
import type {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
import type * as parser from '../lib/Malloy/MalloyParser';
import type {DocumentRange} from '../../model/malloy_types';
import type {MalloyTranslation} from '../parse-malloy';
import {getStringIfShort} from '../parse-utils';

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

  enterRunStatement(pcx: parser.RunStatementContext) {
    this.symbols.push({
      range: this.translator.rangeFromContext(pcx.topLevelAnonQueryDef()),
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

  getNestDefName(pcx: parser.NestDefContext) {
    const nameCx = pcx.queryName();
    if (nameCx) {
      return nameCx.id().text;
    }
    let result: string | undefined = undefined;
    let done = false;
    const vExprListen: MalloyParserListener = {
      enterVArrow(pcx: parser.VArrowContext) {
        pcx.vExpr().enterRule(vExprListen);
      },
      enterVSeg(pcx: parser.VSegContext) {
        pcx.segExpr().enterRule(segExprListen);
      },
    };
    const segExprListen: MalloyParserListener = {
      enterSegField(pcx: parser.SegFieldContext) {
        const names = pcx.fieldPath().fieldName();
        if (!done) result ??= names[names.length - 1].id().text;
      },
      enterSegParen(pcx: parser.SegParenContext) {
        pcx.vExpr().enterRule(vExprListen);
      },
      enterSegRefine(pcx: parser.SegRefineContext) {
        pcx._lhs.enterRule(segExprListen);
      },
      enterSegOps() {
        result = undefined;
        done = true;
      },
    };
    pcx.vExpr().enterRule(vExprListen);
    return result;
  }

  handleNestEntry(pcx: parser.NestDefContext) {
    const name = this.getNestDefName(pcx);
    if (name === undefined) return;
    const symbol = {
      range: this.translator.rangeFromContext(pcx),
      name,
      type: 'query',
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
    return symbol;
  }

  enterNestDef(pcx: parser.NestDefContext) {
    const symbol = this.handleNestEntry(pcx);
    if (symbol) {
      this.scopes.push(symbol);
    }
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

  enterRenameEntry(pcx: parser.RenameEntryContext) {
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
      name: pcx.joinFrom().joinNameDef().id().text,
      type: 'join',
      children: [],
    };
    const parent = this.peekScope();
    if (parent) {
      parent.children.push(symbol);
    }
  }

  enterImportStatement(pcx: parser.ImportStatementContext) {
    const name = getStringIfShort(pcx.importURL());
    if (name) {
      this.scopes.push({
        range: this.translator.rangeFromContext(pcx),
        name,
        type: 'import',
        children: [],
      });
    }
  }

  exitImportStatement() {
    const scope = this.popScope();
    if (scope) {
      this.symbols.push(scope);
    }
  }

  enterImportSelect(pcx: parser.ImportSelectContext) {
    const parent = this.peekScope();
    if (parent) {
      for (const item of pcx.importItem()) {
        const symbol = {
          range: this.translator.rangeFromContext(pcx),
          name: item.text,
          type: 'import_item',
          children: [],
        };
        parent.children.push(symbol);
      }
    }
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
