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
import type { ParseTree } from "antlr4ts/tree";
import * as parser from "../lib/Malloy/MalloyParser";
import { MalloyListener } from "../lib/Malloy/MalloyListener";
import { DocumentRange } from "../../model/malloy-types";
import { MalloyTranslation } from "../parse-malloy";

type References = Record<string, DocumentRange>;

class FindExternalReferences implements MalloyListener {
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
  const listener: MalloyListener = finder;
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
