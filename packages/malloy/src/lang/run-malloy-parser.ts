/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CharStreams, CommonTokenStream} from 'antlr4ts';
import type {ANTLRErrorListener, Token, CodePointCharStream} from 'antlr4ts';
import type {ParseTree} from 'antlr4ts/tree';
import {MalloyLexer} from './lib/Malloy/MalloyLexer';
import {MalloyParser} from './lib/Malloy/MalloyParser';
import {MalloyErrorStrategy} from './syntax-errors/malloy-error-strategy';
import type {MessageLogger} from './parse-log';
import type {ParseInfo, SourceInfo} from './utils';
import {MalloyParserErrorListener} from './syntax-errors/malloy-parser-error-listener';

/**
 * This ignores a -> popMode when the mode stack is empty, which is a hack,
 * but it let's us parse }%
 */
class HandlesOverpoppingLexer extends MalloyLexer {
  popMode(): number {
    if (this._modeStack.isEmpty) {
      return this._mode;
    }
    return super.popMode();
  }
}

export interface MalloyParserSetupOptions {
  // Replace the lexer's default error listener (writes to stderr) with a
  // collector or rewriter. If omitted, default antlr4ts listener is used.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lexerErrorListener?: ANTLRErrorListener<any>;
  // Replace the parser's default error listener. Same shape as above.
  parserErrorListener?: ANTLRErrorListener<Token>;
}

/**
 * Build a Malloy lexer/token-stream/parser triplet ready to invoke a grammar
 * rule on `code`. Centralises the lexer fix (HandlesOverpoppingLexer for
 * unmatched `}%`) and the project's MalloyErrorStrategy so callers can't
 * accidentally diverge on those.
 *
 * The token stream is NOT pre-filled. Callers that need all tokens up front
 * (e.g. the prettifier's leaf walker) should call `tokenStream.fill()` before
 * iterating; callers that only need parser-driven access can leave it alone
 * — the parser pulls tokens as it consumes the rule.
 */
export function makeMalloyParser(
  code: string,
  options: MalloyParserSetupOptions = {}
): {
  inputStream: CodePointCharStream;
  tokenStream: CommonTokenStream;
  parser: MalloyParser;
} {
  const inputStream = CharStreams.fromString(code);
  const lexer = new HandlesOverpoppingLexer(inputStream);
  if (options.lexerErrorListener) {
    lexer.removeErrorListeners();
    lexer.addErrorListener(options.lexerErrorListener);
  }
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new MalloyParser(tokenStream);
  if (options.parserErrorListener) {
    parser.removeErrorListeners();
    parser.addErrorListener(options.parserErrorListener);
  }
  parser.errorHandler = new MalloyErrorStrategy();
  return {inputStream, tokenStream, parser};
}

export function runMalloyParser(
  code: string,
  sourceURL: string,
  sourceInfo: SourceInfo,
  logger: MessageLogger,
  grammarRule = 'malloyDocument'
): ParseInfo {
  const {inputStream, tokenStream, parser} = makeMalloyParser(code, {
    parserErrorListener: new MalloyParserErrorListener(
      logger,
      sourceURL,
      sourceInfo
    ),
  });

  // Admitted code smell here, testing likes to parse from an arbitrary
  // node and this is the simplest way to allow that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseFunc = (parser as any)[grammarRule];
  if (!parseFunc) {
    throw new Error(`No such parse rule as ${grammarRule}`);
  }

  return {
    root: parseFunc.call(parser) as ParseTree,
    tokenStream,
    sourceStream: inputStream,
    sourceInfo,
    sourceURL,
    // TODO some way to not forget to update this
    malloyVersion: '4.0.0',
  };
}
