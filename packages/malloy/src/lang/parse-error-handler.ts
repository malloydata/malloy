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

import { ANTLRErrorListener, Token } from "antlr4ts";
import { MessageLogger, LogMessage } from "./parse-log";
import { MalloyTranslation } from "./parse-malloy";

export class MalloyParserErrorHandler implements ANTLRErrorListener<Token> {
  constructor(
    readonly translator: MalloyTranslation,
    readonly messages: MessageLogger
  ) {}

  syntaxError(
    recognizer: unknown,
    offendingSymbol: Token | undefined,
    line: number,
    charPositionInLine: number,
    msg: string,
    _e: unknown
  ): void {
    const errAt = { line: line - 1, character: charPositionInLine };
    const range = offendingSymbol
      ? this.translator.rangeFromToken(offendingSymbol)
      : { start: errAt, end: errAt };
    const error: LogMessage = {
      message: msg,
      at: { url: this.translator.sourceURL, range },
    };
    this.messages.log(error);
  }
}
