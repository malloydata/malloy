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

export class MalloySQLParseError extends Error {
  public range: MalloySQLParseRange;

  constructor(message: string | undefined, range: MalloySQLParseRange) {
    super(message);
    this.range = range;
  }
}

export class MalloySQLSyntaxError extends MalloySQLParseError {
  public expected: MalloySQLParseErrorExpected[];
  public found: string;

  constructor(
    message: string | undefined,
    expected: MalloySQLParseErrorExpected[],
    found: string,
    range: MalloySQLParseRange
  ) {
    super(message, range);
    this.expected = expected;
    this.found = found;
  }
}

export class MalloySQLConfigurationError extends MalloySQLParseError {}

export class MalloySQLParser {
  private static zeroBasedLocation(
    location: MalloySQLParseLocation
  ): MalloySQLParseLocation {
    return {
      column: location.column,
      line: location.line - 1,
      offset: location.offset,
    };
  }
  private static zeroBasedRange(
    range: MalloySQLParseRange
  ): MalloySQLParseRange {
    return {
      start: this.zeroBasedLocation(range.start),
      end: this.zeroBasedLocation(range.end),
    };
  }

  public static parse(document: string): MalloySQLParse {
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
        error: new MalloySQLSyntaxError(
          e.message,
          e.expected,
          e.found,
          this.zeroBasedRange(e.location)
        ),
      };
    }

    //const totalLines = document.split(/\r\n|\r|\n/).length;
    let previousConnection = '';
    const statements: MalloySQLStatement[] = [];
    let statementIndex = 0;
    let config: MalloySQLStatmentConfig = {};

    if (!parsed.statements) return {statements: []};

    for (const parsedStatement of parsed.statements) {
      if (
        parsedStatement.statementType === 'malloy' &&
        parsedStatement.config !== ''
      ) {
        return {
          statements,
          error: new MalloySQLConfigurationError(
            'only comments allowed after ">>>malloy"',
            this.zeroBasedRange(parsedStatement.delimiterRange)
          ),
        };
      }

      if (parsedStatement.config.startsWith('connection:')) {
        const splitConfig = parsedStatement.config.split('connection:');
        if (splitConfig.length > 0)
          config = {connection: splitConfig[1].trim()};
        else
          return {
            statements,
            error: new MalloySQLConfigurationError(
              '"connection:" found but no connection value provided',
              this.zeroBasedRange(parsedStatement.delimiterRange)
            ),
          };
      }

      const base: MalloySQLStatementBase = {
        statementIndex,
        statementText: parsedStatement.statementText,
        range: this.zeroBasedRange(parsedStatement.range),
        delimiterLocation: this.zeroBasedRange(parsedStatement.delimiterRange),
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
            return {
              statements,
              error: new MalloySQLConfigurationError(
                'No connection configuration specified, add "connection: my_connection_name" to this >>>sql line or to an above one',
                this.zeroBasedRange(parsedStatement.delimiterRange)
              ),
            };
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
              range: this.zeroBasedRange(part.range),
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

    return {statements};
  }
}
