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

  enterTableMethod(pcx: parser.TableMethodContext): void {
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
