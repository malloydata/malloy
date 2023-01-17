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

import { CommonTokenStream } from "antlr4ts";
import { ParseTreeWalker } from "antlr4ts/tree/ParseTreeWalker";
import type { ParseTree } from "antlr4ts/tree";
import * as parser from "../lib/Malloy/MalloyParser";
import { MalloyParserListener } from "../lib/Malloy/MalloyParserListener";
import { DocumentRange } from "../../model/malloy_types";
import { MalloyTranslation } from "../parse-malloy";

type References = Record<string, DocumentRange>;

class FindExternalReferences implements MalloyParserListener {
  needTables: References = {};
  needImports: References = {};

  constructor(
    readonly trans: MalloyTranslation,
    readonly tokens: CommonTokenStream
  ) {}

  enterTableName(pcx: parser.TableNameContext) {
    const tableName = this.tokens.getText(pcx).slice(1, -1);
    if (!this.needTables[tableName]) {
      this.needTables[tableName] = this.trans.rangeFromContext(pcx);
    }
  }

  enterImportURL(pcx: parser.ImportURLContext) {
    const url = JSON.parse(pcx.JSON_STRING().text);
    if (!this.needImports[url]) {
      this.needImports[url] = this.trans.rangeFromContext(pcx);
    }
  }
}

interface FinderFound {
  tables?: References;
  urls?: References;
}
export function findReferences(
  trans: MalloyTranslation,
  tokens: CommonTokenStream,
  parseTree: ParseTree
): FinderFound | null {
  const finder = new FindExternalReferences(trans, tokens);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);

  let refs: FinderFound = {};
  if (Object.keys(finder.needTables).length > 0) {
    refs = { tables: finder.needTables };
  }
  if (Object.keys(finder.needImports).length > 0) {
    refs = { ...refs, urls: finder.needImports };
  }
  return Object.keys(refs).length > 0 ? refs : null;
}
