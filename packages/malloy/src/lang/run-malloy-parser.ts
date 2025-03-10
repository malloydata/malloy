/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  CharStreams,
  CodePointCharStream,
  CommonTokenStream,
  ParserRuleContext,
  Token,
} from 'antlr4ts';
import {MalloyLexer} from './lib/Malloy/MalloyLexer';
import {MalloyParser} from './lib/Malloy/MalloyParser';
import {MalloyParserErrorListener} from './syntax-errors/malloy-parser-error-listener';
import {MalloyErrorStrategy} from './syntax-errors/malloy-error-strategy';
import {ParseTree} from 'antlr4ts/tree';
import {MessageLogger} from './parse-log';
import {DocumentRange} from '../model/malloy_types';

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

export interface SourceInfo {
  lines: string[];
  at: {begin: number; end: number}[];
  length: number;
}

export function rangeFromTokens(
  sourceInfo: SourceInfo | undefined,
  startToken: Token,
  stopToken: Token
): DocumentRange {
  const start = {
    line: startToken.line - 1,
    character: startToken.charPositionInLine,
  };
  if (sourceInfo && stopToken.stopIndex !== -1) {
    // Find the line which contains the stopIndex
    const lastLine = sourceInfo.lines.length - 1;
    for (let lineNo = startToken.line - 1; lineNo <= lastLine; lineNo++) {
      const at = sourceInfo.at[lineNo];
      if (stopToken.stopIndex >= at.begin && stopToken.stopIndex < at.end) {
        return {
          start,
          end: {
            line: lineNo,
            character: stopToken.stopIndex - at.begin + 1,
          },
        };
      }
    }
    // Should be impossible to get here, but if we do ... return the last
    // character of the last line of the file
    return {
      start,
      end: {
        line: lastLine,
        character: sourceInfo.lines[lastLine].length,
      },
    };
  }
  return {start, end: start};
}

export function rangeFromToken(
  sourceInfo: SourceInfo | undefined,
  token: Token
): DocumentRange {
  return rangeFromTokens(sourceInfo, token, token);
}

export function rangeFromContext(
  sourceInfo: SourceInfo | undefined,
  pcx: ParserRuleContext
): DocumentRange {
  return rangeFromTokens(sourceInfo, pcx.start, pcx.stop || pcx.start);
}

/**
 * Split the source up into lines so we can correctly compute offset
 * to the line/char positions favored by LSP and VSCode.
 */
export function getSourceInfo(code: string): SourceInfo {
  const eolRegex = /\r?\n/;
  const info: SourceInfo = {
    at: [],
    lines: [],
    length: code.length,
  };
  let src = code;
  let lineStart = 0;
  while (src !== '') {
    const eol = src.match(eolRegex);
    if (eol && eol.index !== undefined) {
      // line text DOES NOT include the EOL
      info.lines.push(src.slice(0, eol.index));
      const lineLength = eol.index + eol[0].length;
      info.at.push({
        begin: lineStart,
        end: lineStart + lineLength,
      });
      lineStart += lineLength;
      src = src.slice(lineLength);
    } else {
      // last line, does not have a line end
      info.lines.push(src);
      info.at.push({begin: lineStart, end: lineStart + src.length});
      break;
    }
  }
  return info;
}

export interface ParseInfo {
  root: ParseTree;
  tokenStream: CommonTokenStream;
  sourceStream: CodePointCharStream;
  sourceURL: string;
  malloyVersion: string;
  sourceInfo: SourceInfo;
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
