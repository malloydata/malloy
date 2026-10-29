/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  LogMessage,
  DocumentRange,
  DocumentPosition,
} from '@malloydata/malloy';
import * as parser from './grammar/malloySQL';
import type {
  MalloySQLStatementConfig,
  MalloySQLStatementBase,
  MalloySQLStatement,
  MalloySQLParseResults,
  MalloySQLParseRange,
  MalloySQLParseLocation,
} from './types';
import {MalloySQLStatementType} from './types';
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
    code: string,
    message: string,
    range: MalloySQLParseRange,
    url = '.'
  ): MalloySQLParseError {
    const log: LogMessage = {
      message,
      code,
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
      const p = parser.parse(document, undefined);
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
                code: 'malloysql-syntax-error',
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
    const {initialComments} = parsed;
    const initialCommentsLineCount =
      initialComments.split(/\r\n|\r|\n/).length - 1;
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
            'malloysql-illegal-statement-in-malloy-block',
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
              'malloysql-invalid-connection-specification',
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
                'malloysql-missing-connection-specification',
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
      initialComments,
    };
  }
}

export interface MalloySQLParse {
  statements: MalloySQLStatement[];
  errors: MalloySQLParseError[];
  initialCommentsLineCount?: number;
  initialComments?: string;
}
