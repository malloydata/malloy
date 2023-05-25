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

import {
  LogMessage,
  MalloyError,
  DocumentRange,
  DocumentPosition,
} from '@malloydata/malloy';
import * as parser from './grammar/malloySQL';
import {
  MalloySQLStatmentConfig,
  MalloySQLStatementBase,
  MalloySQLStatement,
  MalloySQLParseResults,
  MalloySQLStatementType,
  ParsedMalloySQLMalloyStatementPart,
  MalloySQLParseRange,
  MalloySQLParseErrorExpected,
  MalloySQLParse,
  MalloySQLParseLocation,
} from './types';

export class MalloySQLParseError extends MalloyError {
  constructor(message: string, log: LogMessage[] = []) {
    super(message, log);
  }
}

export class MalloySQLSyntaxError extends MalloySQLParseError {
  public expected: MalloySQLParseErrorExpected[];
  public found: string;

  constructor(
    message: string,
    log: LogMessage[],
    expected: MalloySQLParseErrorExpected[],
    found: string
  ) {
    super(message, log);
    this.expected = expected;
    this.found = found;
  }
}

export class MalloySQLParser {
  private static convertLocation(
    location: MalloySQLParseLocation
  ): DocumentPosition {
    return {
      character: location.column,
      line: location.line - 1,
    };
  }
  private static convertRange(range: MalloySQLParseRange): DocumentRange {
    return {
      start: this.convertLocation(range.start),
      end: this.convertLocation(range.end),
    };
  }
  private static createParseError(
    message: string,
    range: MalloySQLParseRange,
    url = '.'
  ): MalloySQLParseError {
    const log: LogMessage = {
      message,
      at: {
        url,
        range: this.convertRange(range),
      },
    };
    return new MalloySQLParseError(message, [log]);
  }

  // passing a URL returns the URL in MalloyError.log entries
  public static parse(document: string, url = '.'): MalloySQLParse {
    let parsed: MalloySQLParseResults;

    try {
      const p = parser.parse(document);
      parsed = {
        initialComments: p[0],
        statements: p[1],
      };
    } catch (e) {
      return {
        statements: [],
        errors: [
          new MalloySQLSyntaxError(
            e.message,
            [
              {
                message: e.message,
                at: {url, range: this.convertRange(e.location)},
              },
            ],
            e.expected,
            e.found
          ),
        ],
      };
    }

    let previousConnection = '';
    const statements: MalloySQLStatement[] = [];
    const initialCommentsLineCount =
      parsed.initialComments.split(/\r\n|\r|\n/).length - 1;
    let statementIndex = 0;
    let config: MalloySQLStatmentConfig = {};
    const errors: MalloySQLParseError[] = [];

    if (!parsed.statements) return {statements, errors};

    for (const parsedStatement of parsed.statements) {
      if (
        parsedStatement.statementType === 'malloy' &&
        parsedStatement.config !== ''
      ) {
        errors.push(
          this.createParseError(
            'Only comments are allowed after ">>>malloy"',
            parsedStatement.delimiterRange
          )
        );
      }

      if (parsedStatement.config.startsWith('connection:')) {
        const splitConfig = parsedStatement.config.split('connection:');
        if (splitConfig.length > 0)
          config = {connection: splitConfig[1].trim()};
        else
          errors.push(
            this.createParseError(
              '"connection:" found but no connection value was provided',
              parsedStatement.delimiterRange
            )
          );
      }

      const base: MalloySQLStatementBase = {
        statementIndex,
        statementText: parsedStatement.statementText,
        range: this.convertRange(parsedStatement.range),
        delimiterRange: this.convertRange(parsedStatement.delimiterRange),
      };
      statementIndex += 1;

      if (parsedStatement.statementType === 'malloy') {
        statements.push({
          ...base,
          config,
          type: MalloySQLStatementType.MALLOY,
        });
      } else {
        if (!config.connection) {
          if (!previousConnection)
            errors.push(
              this.createParseError(
                'No connection configuration specified, add "connection: my_connection_name" to this >>>sql line or to an above one',
                parsedStatement.delimiterRange
              )
            );
          config.connection = previousConnection;
        }

        previousConnection = config.connection;
        const embeddedMalloyQueries = parsedStatement.parts
          .filter((part): part is ParsedMalloySQLMalloyStatementPart => {
            return part.type === 'malloy';
          })
          .map(part => {
            return {
              query: part.malloy,
              parenthized: part.parenthized,
              range: this.convertRange(part.range),
            };
          });

        statements.push({
          ...base,
          config,
          type: MalloySQLStatementType.SQL,
          embeddedMalloyQueries,
        });
      }
    }

    return {
      statements,
      errors,
      initialCommentsLineCount,
    };
  }
}
