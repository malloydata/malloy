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
} from './types';

export class MalloySQLParseError extends Error {
  public location: MalloySQLParseRange;

  constructor(message: string | undefined, location) {
    super(message);
    this.location = location;
  }
}

export class MalloySQLSyntaxError extends MalloySQLParseError {
  public expected: MalloySQLParseErrorExpected[];
  public found: string;

  constructor(message: string | undefined, expected, found, location) {
    super(message, location);
    this.expected = expected;
    this.found = found;
  }
}

export class MalloySQLConfigurationError extends MalloySQLParseError {}

export class MalloySQLParser {
  constructor() {}

  public parse(document: string): MalloySQLStatement[] {
    let parsed: MalloySQLParseResults;
    try {
      const p = parser.parse(document);
      parsed = {
        initialComments: p[0],
        statements: p[1],
      };
    } catch (e) {
      throw new MalloySQLSyntaxError(
        e.message,
        e.expected,
        e.found,
        e.location
      );
    }

    //const totalLines = document.split(/\r\n|\r|\n/).length;

    if (!parsed.statements) return [];

    let previousConnection = '';
    const statements: MalloySQLStatement[] = [];
    let statementIndex = 0;

    for (const parsedStatement of parsed.statements) {
      let config: MalloySQLStatmentConfig;
      if (parsedStatement.config.startsWith('connection:')) {
        const splitConfig = parsedStatement.config.split('connection:');
        if (splitConfig.length > 0)
          config = {connection: splitConfig[1].trim()};
        else
          throw new MalloySQLConfigurationError(
            '"connection:" found but no connection value provided',
            parsedStatement.controlLineLocation
          );
      } else {
        try {
          config = JSON.parse(parsedStatement.config);
        } catch (e) {
          throw new MalloySQLConfigurationError(
            `no simple "connection: myconnection" string found after
            ">>>${parsedStatement.statementType}", trying to parse
            everything after ">>>${parsedStatement.statementType} as JSON and
            failed with ${e.message}`,
            parsedStatement.controlLineLocation
          );
        }
      }

      if (!config.connection) {
        if (!previousConnection)
          throw new MalloySQLConfigurationError(
            'No connection configuration specified, add "connection: my_connection_name" to the >>> line',
            parsedStatement.controlLineLocation
          );
        config.connection = previousConnection;
      }

      previousConnection = config.connection;

      const base: MalloySQLStatementBase = {
        statementIndex,
        statementText: parsedStatement.statementText,
        config,
        location: parsedStatement.location,
        controlLineLocation: parsedStatement.controlLineLocation,
      };
      statementIndex += 1;

      if (parsedStatement.statementType === 'malloy') {
        statements.push({
          ...base,
          type: MalloySQLStatementType.MALLOY,
        });
      } else {
        const embeddedMalloyQueries = parsedStatement.parts
          .filter((part): part is ParsedMalloySQLMalloyStatementPart => {
            return part.type === 'malloy';
          })
          .map(part => {
            return {
              query: part.malloy,
              parenthized: part.parenthized,
              location: part.location,
            };
          });

        statements.push({
          ...base,
          type: MalloySQLStatementType.SQL,
          embeddedMalloyQueries,
        });
      }
    }

    return statements;
  }
}
