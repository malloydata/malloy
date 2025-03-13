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

import type {
  CodePointCharStream,
  CommonTokenStream,
  ParserRuleContext,
  Token,
} from 'antlr4ts';
import type {
  DocumentLocation,
  DocumentPosition,
  DocumentRange,
} from '../model/malloy_types';
import type {ParseTree} from 'antlr4ts/tree';

export function locationContainsPosition(
  location: DocumentLocation,
  position: DocumentPosition
): boolean {
  return (
    location.range.start.line <= position.line &&
    location.range.end.line >= position.line &&
    (position.line !== location.range.start.line ||
      position.character >= location.range.start.character) &&
    (position.line !== location.range.end.line ||
      position.character <= location.range.end.character)
  );
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
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
