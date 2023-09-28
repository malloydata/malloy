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

import {ParseTreeVisitor, ParseTree, ParserRuleContext} from 'antlr4';
import {
  ExplorePropertiesContext,
  MalloyDocumentContext,
  QueryPropertiesContext,
} from '../lib/Malloy/MalloyParser';
import MalloyParserVisitor from '../lib/Malloy/MalloyParserVisitor';
import { rangeOf, inRange } from './walker-utils';

export interface DocumentHelpContext {
  type: string;
  token: string | undefined;
}

class HelpContextVisitor
  extends ParseTreeVisitor<DocumentHelpContext | undefined>
  implements MalloyParserVisitor<DocumentHelpContext | undefined>
{
  type = '';

  constructor(readonly position: {line: number; character: number}) {
    super();
  }

  defaultResult(): DocumentHelpContext | undefined {
    return undefined;
  }

  visitChildren(ctx: ParserRuleContext) {
    let result = this.defaultResult();
    // if (inRange(this.position, rangeOf(ctx))) {
    //   result = {
    //     type: this.type,
    //     token: ctx.start.text,
    //   };
    //   const n = ctx.childCount;
    //   for (let i = 0; i < n; i++) {
    //     const c = ctx.getChild(i);
    //     const childResult = c.accept(this);
    //     if (childResult) {
    //       result = this.aggregateResult(result, childResult);
    //     }
    //   }
    // }
    return result;
  }

  visitMalloyDocument(
    ctx: MalloyDocumentContext
  ): DocumentHelpContext | undefined {
    if (inRange(this.position, rangeOf(ctx))) {
      this.type = 'model_property';
      return this.visitChildren(ctx);
    }
    return this.defaultResult();
  }

  visitExploreProperties(
    ctx: ExplorePropertiesContext
  ): DocumentHelpContext | undefined {
    if (inRange(this.position, rangeOf(ctx))) {
      this.type = 'explore_property';
      return this.visitChildren(ctx);
    }
    return this.defaultResult();
  }

  visitQueryProperties(
    ctx: QueryPropertiesContext
  ): DocumentHelpContext | undefined {
    if (inRange(this.position, rangeOf(ctx))) {
      this.type = 'query_property';
      return this.visitChildren(ctx);
    }
    return this.defaultResult();
  }

  protected aggregateResult(
    _aggregate: DocumentHelpContext | undefined,
    nextResult: DocumentHelpContext | undefined
  ): DocumentHelpContext | undefined {
    return nextResult;
  }
}

export function walkForDocumentHelpContext(
  parseTree: ParseTree,
  position: {line: number; character: number}
): DocumentHelpContext | undefined {
  const visitor = new HelpContextVisitor(position);
  return visitor.visit(parseTree);
}
