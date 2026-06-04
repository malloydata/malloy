/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
import {getId, getPlainString} from '../parse-utils';
import type {MalloyTranslation} from '../parse-malloy';
import type {CommonTokenStream} from 'antlr4ts';
import type {DocumentRange} from '../../model/malloy_types';
import type * as parser from '../lib/Malloy/MalloyParser';
import type {MalloyParseInfo} from '../malloy-parse-info';
import {ParseTreeWalker} from 'antlr4ts/tree/ParseTreeWalker';

export interface PathInfo {
  connectionId: string;
  tablePath: string;
  range: DocumentRange;
}

class FindTablePathWalker implements MalloyParserListener {
  pathInfos: PathInfo[] = [];
  constructor(
    readonly translator: MalloyTranslation,
    readonly tokens: CommonTokenStream
  ) {}

  enterExploreTable(pcx: parser.ExploreTableContext): void {
    const connectionId = getId(pcx.connectionId());
    const [tablePath, _errorList] = getPlainString(pcx.tablePath(), true);
    if (tablePath !== undefined) {
      this.pathInfos.push({
        connectionId,
        tablePath,
        range: this.translator.rangeFromContext(pcx),
      });
    }
  }
}

export function walkForTablePath(
  forParse: MalloyTranslation,
  tokens: CommonTokenStream,
  parseInfo: MalloyParseInfo
): PathInfo[] {
  const finder = new FindTablePathWalker(forParse, tokens);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseInfo.root);
  return finder.pathInfos;
}
