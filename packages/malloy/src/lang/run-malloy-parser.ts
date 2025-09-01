/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {CharStreams, CommonTokenStream} from 'antlr4ts';
import {MalloyLexer} from './lib/Malloy/MalloyLexer';
import {MalloyParser} from './lib/Malloy/MalloyParser';
import {MalloyErrorStrategy} from './syntax-errors/malloy-error-strategy';
import type {ParseTree} from 'antlr4ts/tree';
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

export function runMalloyParser(
  code: string,
  sourceURL: string,
  sourceInfo: SourceInfo,
  logger: MessageLogger,
  grammarRule = 'malloyDocument'
): ParseInfo {
  const inputStream = CharStreams.fromString(code);
  const lexer = new HandlesOverpoppingLexer(inputStream);
  const tokenStream = new CommonTokenStream(lexer);
  const malloyParser = new MalloyParser(tokenStream);
  malloyParser.removeErrorListeners();
  malloyParser.addErrorListener(
    new MalloyParserErrorListener(logger, sourceURL, sourceInfo)
  );
  malloyParser.errorHandler = new MalloyErrorStrategy();

  // Admitted code smell here, testing likes to parse from an arbitrary
  // node and this is the simplest way to allow that.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseFunc = (malloyParser as any)[grammarRule];
  if (!parseFunc) {
    throw new Error(`No such parse rule as ${grammarRule}`);
  }

  return {
    root: parseFunc.call(malloyParser) as ParseTree,
    tokenStream: tokenStream,
    sourceStream: inputStream,
    sourceInfo,
    sourceURL,
    // TODO some way to not forget to update this
    malloyVersion: '4.0.0',
  };
}
