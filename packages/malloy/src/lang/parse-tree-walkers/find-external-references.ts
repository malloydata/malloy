/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CommonTokenStream} from 'antlr4ts';
import {ParseTreeWalker} from 'antlr4ts/tree/ParseTreeWalker';
import type {ParseTree} from 'antlr4ts/tree';
import type * as parser from '../lib/Malloy/MalloyParser';
import type {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
import type {DocumentRange} from '../../model/malloy_types';
import type {MalloyTranslation} from '../parse-malloy';
import type {HasString} from '../parse-utils';
import {getId, getStringIfShort, getStringParts} from '../parse-utils';

type NeedImports = Record<string, DocumentRange>;
type NeedTables = Record<
  string,
  {
    connectionName: string;
    tablePath: string;
    firstReference: DocumentRange;
  }
>;
type NeedConnectionDialects = Record<
  string,
  {
    firstReference: DocumentRange;
  }
>;

// Copy of the version in the parser which also errors on each non-string in a
// multi-line string collection. No need to error here, which is well, because
// we don't have access to the error log.
function getPlainString(cx: HasString): string {
  const shortStr = getStringIfShort(cx);
  if (shortStr) {
    return shortStr;
  }
  const safeParts: string[] = [];
  const multiLineStr = cx.string().sqlString();
  if (multiLineStr) {
    for (const part of getStringParts(multiLineStr)) {
      if (typeof part === 'string') {
        safeParts.push(part);
      }
    }
    return safeParts.join('');
  }
  return '';
}

class FindExternalReferences implements MalloyParserListener {
  needTables: NeedTables = {};
  needImports: NeedImports = {};
  needConnectionDialects: NeedConnectionDialects = {};

  constructor(
    readonly trans: MalloyTranslation,
    readonly tokens: CommonTokenStream
  ) {}

  registerTableReference(
    connectionName: string,
    tablePath: string,
    reference: DocumentRange
  ) {
    const key = constructTableKey(connectionName, tablePath);
    if (!this.needTables[key]) {
      this.needTables[key] = {
        connectionName,
        tablePath,
        firstReference: reference,
      };
    }
  }

  enterExploreTable(pcx: parser.ExploreTableContext) {
    const connId = getId(pcx.connectionId());
    const tablePath = getPlainString(pcx.tablePath());
    const reference = this.trans.rangeFromContext(pcx);
    this.registerTableReference(connId, tablePath, reference);
    // Register a need for the connection's dialect so the validator in
    // ImportsAndTablesStep can run against it.
    if (!this.needConnectionDialects[connId]) {
      this.needConnectionDialects[connId] = {firstReference: reference};
    }
  }

  enterVirtualSource(pcx: parser.VirtualSourceContext) {
    const connId = getId(pcx.connectionId());
    if (connId && !this.needConnectionDialects[connId]) {
      this.needConnectionDialects[connId] = {
        firstReference: this.trans.rangeFromContext(pcx),
      };
    }
  }

  enterImportURL(pcx: parser.ImportURLContext) {
    const url = getPlainString(pcx);
    if (!this.needImports[url]) {
      this.needImports[url] = this.trans.rangeFromContext(pcx);
    }
  }
}

export function constructTableKey(
  connectionName: string,
  tablePath: string
): string {
  return `${connectionName}:${tablePath}`;
}

export interface FindReferencesData {
  tables: NeedTables;
  urls: NeedImports;
  connectionDialects: NeedConnectionDialects;
}
export function findReferences(
  trans: MalloyTranslation,
  tokens: CommonTokenStream,
  parseTree: ParseTree
): FindReferencesData {
  const finder = new FindExternalReferences(trans, tokens);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);

  return {
    tables: finder.needTables,
    urls: finder.needImports,
    connectionDialects: finder.needConnectionDialects,
  };
}
