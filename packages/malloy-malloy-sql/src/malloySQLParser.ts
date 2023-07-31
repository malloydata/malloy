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

import {LogMessage, DocumentRange, DocumentPosition} from '@malloydata/malloy';
import * as parser from './grammar/malloySQL';
import {
  MalloySQLStatementConfig,
  MalloySQLStatementBase,
  MalloySQLStatement,
  MalloySQLParseResults,
  MalloySQLStatementType,
  MalloySQLParseRange,
  MalloySQLParseLocation,
} from './types';
import {MalloySQLSQLParser} from './malloySQLSQLParser';
import {MalloySQLParseError, MalloySQLSyntaxError} from './malloySQLErrors';

export class MalloySQLParser {
  private static convertLocation(
    location: MalloySQLParseLocation
  ): DocumentPosition {
    // VSCode expects line/character numbers to be zero-based
    return {
      character: location.column - 1,
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
      severity: 'error',
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
                severity: 'error',
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
    const errors: MalloySQLParseError[] = [];

    if (!parsed.statements) return {statements, errors};

    for (const parsedStatement of parsed.statements) {
      let config: MalloySQLStatementConfig = {};

      if (
        parsedStatement.statementType === 'malloy' &&
        parsedStatement.config !== ''
      ) {
        errors.push(
          this.createParseError(
            'Only comments are allowed after ">>>malloy"',
            parsedStatement.delimiterRange,
            url
          )
        );
      }

      if (parsedStatement.config.startsWith('connection:')) {
        const splitConfig = parsedStatement.config.split('connection:');
        if (splitConfig.length > 0)
          config = {connection: splitConfig[1].trim(), fromDelimiter: true};
        else
          errors.push(
            this.createParseError(
              '"connection:" found but no connection value was provided',
              parsedStatement.delimiterRange,
              url
            )
          );
      }

      const base: MalloySQLStatementBase = {
        index: statementIndex,
        text: parsedStatement.statementText,
        range: this.convertRange(parsedStatement.range),
        delimiterRange: this.convertRange(parsedStatement.delimiterRange),
      };
      statementIndex += 1;

      if (parsedStatement.statementType === 'markdown') {
        statements.push({
          ...base,
          config,
          type: MalloySQLStatementType.MARKDOWN,
        });
      } else if (parsedStatement.statementType === 'malloy') {
        statements.push({
          ...base,
          config,
          type: MalloySQLStatementType.MALLOY,
        });
      } else {
        const parsedMalloySQLSQL = MalloySQLSQLParser.parse(
          parsedStatement.statementText,
          url,
          parsedStatement.range.start
        );

        config = {...config, ...parsedMalloySQLSQL.config};

        if (!config.connection) {
          if (!previousConnection)
            errors.push(
              this.createParseError(
                'No connection configuration specified',
                parsedStatement.delimiterRange,
                url
              )
            );
          config.connection = previousConnection;
          config.inheritedConnection = true;
        }

        previousConnection = config.connection;

        const embeddedMalloyQueries = parsedMalloySQLSQL.embeddedMalloyQueries;

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

export interface MalloySQLParse {
  statements: MalloySQLStatement[];
  errors: MalloySQLParseError[];
  initialCommentsLineCount?: number;
}
