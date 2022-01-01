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

  // just to make this compile, no need for this
  inDocument = false;
  enterMalloyDocument(): void {
    this.inDocument = true;
  }

  // enterNamelessQuery(pcx: parser.NamelessQueryContext) {
  //   this.symbols.push({
  //     range: this.rangeOf(pcx),
  //     name: "unnamed_query",
  //     type: "unnamed_query",
  //     children: [],
  //   });
  // }

  // enterDefineStatement(pcx: parser.DefineStatementContext) {
  //   const defineValue = pcx.defineValue();
  //   let type;
  //   if (defineValue instanceof parser.DefFromExploreContext) {
  //     if (defineValue.explore().EXPLORE()) {
  //       type = "explore";
  //     } else {
  //       type = "query";
  //     }
  //   } else {
  //     type = "explore";
  //   }
  //   this.scopes.push({
  //     range: this.rangeOf(pcx),
  //     name: pcx.id().text,
  //     type,
  //     children: [],
  //   });
  // }

  // exitDefineStatement(_pcx: parser.DefineStatementContext) {
  //   const scope = this.popScope();
  //   if (scope) {
  //     this.symbols.push(scope);
  //   }
  // }

  // enterExpressionFieldDef(pcx: parser.ExpressionFieldDefContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.defineName().id().text,
  //     type: "field",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  // }

  // enterTurtleFieldDef(pcx: parser.TurtleFieldDefContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.defineName().id().text,
  //     type: "turtle",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  //   this.scopes.push(symbol);
  // }

  // exitTurtleFieldDef(_pcx: parser.TurtleFieldDefContext) {
  //   this.popScope();
  // }

  // enterIndexStage(pcx: parser.IndexStageContext) {
  //   // TODO this gets "x.*" as one "field_name"
  //   pcx.fieldNameCollection().forEach((collection) => {
  //     collection.collectionMember().forEach((member) => {
  //       const symbol = {
  //         range: this.rangeOf(member),
  //         name: member.text,
  //         type: "field",
  //         children: [],
  //       };
  //       const parent = this.peekScope();
  //       if (parent) {
  //         parent.children.push(symbol);
  //       }
  //     });
  //   });
  // }

  // enterFieldReflist(pcx: parser.FieldReflistContext) {
  //   // TODO this gets "x.*" as one "field_name"
  //   pcx
  //     .fieldNameCollection()
  //     .collectionMember()
  //     .forEach((member) => {
  //       const symbol = {
  //         range: this.rangeOf(member),
  //         name: member.text,
  //         type: "field",
  //         children: [],
  //       };
  //       const parent = this.peekScope();
  //       if (parent) {
  //         parent.children.push(symbol);
  //       }
  //     });
  // }

  // enterNameOnlyDef(pcx: parser.NameOnlyDefContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.defineName().id().text,
  //     type: "field",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  // }

  // enterRenameFieldDef(pcx: parser.RenameFieldDefContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.id()[0].text,
  //     type: "field",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  // }

  // enterJoinDef(pcx: parser.JoinDefContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.id().text,
  //     type: "join",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  // }

  // enterJoinOn(pcx: parser.JoinOnContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.id().text,
  //     type: "join",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  // }

  // enterJoinSource(pcx: parser.JoinSourceContext) {
  //   const symbol = {
  //     range: this.rangeOf(pcx),
  //     name: pcx.id().text,
  //     type: "join",
  //     children: [],
  //   };
  //   const parent = this.peekScope();
  //   if (parent) {
  //     parent.children.push(symbol);
  //   }
  // }
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
