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

import {ParseTree, ParseTreeWalker, CommonTokenStream, ParserRuleContext, ParseTreeListener} from 'antlr4';
import MalloyParserListener from '../lib/Malloy/MalloyParserListener';
import * as parser from '../lib/Malloy/MalloyParser';
import { inRange, rangeOf } from './walker-utils';

export interface DocumentCompletion {
  type: string;
  text: string;
}

const EXPLORE_PROPERTIES = [
  'dimension',
  'measure',
  'join_one',
  'join_many',
  'join_cross',
  'where',
  'primary_key',
  'rename',
  'accept',
  'except',
  'query',
  'declare',
];

const QUERY_PROPERTIES = [
  'group_by',
  'project',
  'index',
  'aggregate',
  'top',
  'limit',
  'order_by',
  'where',
  'having',
  'nest',
  'declare',
];

const MODEL_PROPERTIES = ['source', 'explore', 'query', 'sql'];

class DocumentCompletionWalker
  extends ParseTreeListener
  implements MalloyParserListener
{
  constructor(
    readonly tokens: CommonTokenStream,
    readonly completions: DocumentCompletion[],
    readonly position: {line: number; character: number}
  ) {
    super();
  }

  rangeOf(pcx: ParserRuleContext) {
    const stopToken = pcx.stop || pcx.start;
    return {
      start: {
        line: pcx.start.line - 1,
        character: pcx.start.column,
      },
      end: {
        line: stopToken.line - 1,
        character:
          stopToken.stop -
          (stopToken.start - stopToken.column) +
          1,
      },
    };
  }

  enterExploreProperties(ctx: parser.ExplorePropertiesContext) {
    if (inRange(this.position, rangeOf(ctx))) {
      let insideStatement = false;
      for (const exploreStatementContext of ctx.exploreStatement_list()) {
        if (inRange(this.position, rangeOf(exploreStatementContext))) {
          insideStatement = true;
        }
      }
      if (!insideStatement) {
        for (const property of EXPLORE_PROPERTIES) {
          this.completions.push({
            type: 'explore_property',
            text: `${property}: `,
          });
        }
      }
    }
  }

  enterQueryProperties(ctx: parser.QueryPropertiesContext) {
    if (inRange(this.position, rangeOf(ctx))) {
      let insideStatement = false;
      for (const exploreStatementContext of ctx.queryStatement_list()) {
        if (inRange(this.position, rangeOf(exploreStatementContext))) {
          insideStatement = true;
        }
      }
      if (!insideStatement) {
        for (const property of QUERY_PROPERTIES) {
          this.completions.push({
            type: 'query_property',
            text: `${property}: `,
          });
        }
      }
    }
  }

  enterMalloyDocument(ctx: parser.MalloyDocumentContext) {
    if (inRange(this.position, rangeOf(ctx))) {
      let insideStatement = false;
      for (const modelStatementContext of ctx.malloyStatement_list()) {
        if (inRange(this.position, rangeOf(modelStatementContext))) {
          insideStatement = true;
        }
      }
      if (!insideStatement) {
        for (const property of MODEL_PROPERTIES) {
          this.completions.push({
            type: 'model_property',
            text: `${property}: `,
          });
        }
      }
    }
  }
}

export function walkForDocumentCompletions(
  tokens: CommonTokenStream,
  parseTree: ParseTree,
  position: {line: number; character: number}
): DocumentCompletion[] {
  const finder = new DocumentCompletionWalker(tokens, [], position);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseTree);
  return finder.completions;
}
