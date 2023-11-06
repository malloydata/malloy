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

// taze: RegExpExecArray.groups from //third_party/javascript/node_modules/typescript:es2018.regexp
import {DocumentRange, DocumentPosition} from '@malloydata/malloy';
import * as parser from './grammar/malloySQLSQL';
import {
  MalloySQLSQLParseResults,
  ParsedMalloySQLMalloyStatementPart,
  MalloySQLParseRange,
  MalloySQLParseLocation,
  EmbeddedMalloyQuery,
  ParsedMalloySQLOtherStatementPart,
  EmbeddedComment,
  MalloySQLStatementConfig,
} from './types';
import {MalloySQLParseError, MalloySQLSyntaxError} from './malloySQLErrors';

export class MalloySQLSQLParser {
  private static convertLocation(
    location: MalloySQLParseLocation,
    start: MalloySQLParseLocation | null
  ): DocumentPosition {
    // VSCode expects line/character numbers to be zero-based
    const result = {
      character: location.column - 1,
      line: location.line - 1,
    };
    if (start) {
      result.line += start.line - 1;
    }

    return result;
  }
  private static convertRange(
    range: MalloySQLParseRange,
    start: MalloySQLParseLocation | null
  ): DocumentRange {
    return {
      start: this.convertLocation(range.start, start),
      end: this.convertLocation(range.end, start),
    };
  }

  // passing a URL returns the URL in MalloyError.log entries
  public static parse(
    document: string,
    url = '.',
    start: MalloySQLParseLocation | null = null
  ): MalloySQLSQLParse {
    let parsed: MalloySQLSQLParseResults;

    try {
      parsed = parser.parse(document, undefined);
    } catch (e) {
      return {
        comments: [],
        config: {},
        embeddedMalloyQueries: [],
        errors: [
          new MalloySQLSyntaxError(
            e.message,
            [
              {
                message: e.message,
                at: {url, range: this.convertRange(e.location, start)},
                severity: 'error',
              },
            ],
            e.expected,
            e.found
          ),
        ],
      };
    }

    if (!parsed.parts)
      return {comments: [], config: {}, embeddedMalloyQueries: [], errors: []};

    const comments = parsed.parts
      .filter((part): part is ParsedMalloySQLOtherStatementPart => {
        return part.type === 'comment';
      })
      .map(part => {
        return {
          range: this.convertRange(part.range, start),
          text: part.text,
        };
      });

    const embeddedMalloyQueries = parsed.parts
      .filter((part): part is ParsedMalloySQLMalloyStatementPart => {
        return part.type === 'malloy';
      })
      .map(part => {
        return {
          query: part.malloy,
          parenthesized: part.parenthesized,
          range: this.convertRange(part.range, start),
          text: part.text,
          malloyRange: this.convertRange(part.malloyRange, start),
        };
      });

    const config: MalloySQLStatementConfig = {};

    for (const comment of comments) {
      const match = /\bconnection:\s*(?<connectionName>\S*)/.exec(comment.text);
      if (match && match.groups) {
        config.connection = match.groups['connectionName'];
      }
    }

    return {
      comments,
      config,
      embeddedMalloyQueries,
      errors: [],
    };
  }
}

export interface MalloySQLSQLParse {
  comments: EmbeddedComment[];
  config: MalloySQLStatementConfig;
  embeddedMalloyQueries: EmbeddedMalloyQuery[];
  errors: MalloySQLParseError[];
}
