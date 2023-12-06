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
import * as parser from '../lib/Malloy/MalloyParser';
import {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
import {DocumentRange} from '../../model/malloy_types';
import {MalloyTranslation} from '../parse-malloy';
import {
  HasString,
  getId,
  getStringIfShort,
  getStringParts,
} from '../parse-utils';

type NeedImports = Record<string, DocumentRange>;
type NeedTables = Record<
  string,
  {
    connectionName: string | undefined;
    tablePath: string;
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

  constructor(
    readonly trans: MalloyTranslation,
    readonly tokens: CommonTokenStream
  ) {}

  registerTableReference(
    connectionName: string | undefined,
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

  enterTableMethod(pcx: parser.TableMethodContext) {
    const connId = getId(pcx.connectionId());
    const tablePath = getPlainString(pcx.tablePath());
    const reference = this.trans.rangeFromContext(pcx);
    this.registerTableReference(connId, tablePath, reference);
  }

  enterTableFunction(pcx: parser.TableFunctionContext) {
    const tableURI = getPlainString(pcx.tableURI());
    // This use of `deprecatedParseTableURI` is ok because it is for handling the
    // old, soon-to-be-deprecated table syntax.
    const {connectionName, tablePath} = deprecatedParseTableURI(tableURI);
    const reference = this.trans.rangeFromContext(pcx);
    this.registerTableReference(connectionName, tablePath, reference);
  }

  enterImportURL(pcx: parser.ImportURLContext) {
    const url = getPlainString(pcx);
    if (!this.needImports[url]) {
      this.needImports[url] = this.trans.rangeFromContext(pcx);
    }
  }
}

export function constructTableKey(
  connectionName: string | undefined,
  tablePath: string
): string {
  return connectionName === undefined
    ? tablePath
    : `${connectionName}:${tablePath}`;
}

/**
 * This function parses an old-style `tableURI` into a connection name and
 * table path. The name includes `deprecated` because it should only be used
 * in the (deprecated) old-style `table('conn:tab')` syntax. Any use of this
 * anywhere else is bad.
 * @param tableURI The sting that is passed into the `table('conn:tab')` syntax.
 * @returns A connection name and table path.
 * @deprecated
 */
export function deprecatedParseTableURI(tableURI: string): {
  connectionName?: string;
  tablePath: string;
} {
  const parts = tableURI.match(/^([^:]*):(.*)$/);
  if (parts) {
    const [, firstPart, secondPart] = parts;
    return {connectionName: firstPart, tablePath: secondPart};
  } else {
    return {tablePath: tableURI};
  }
}

export interface FindReferencesData {
  tables: NeedTables;
  urls: NeedImports;
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
  };
}
