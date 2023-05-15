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

export interface MalloySQLParseErrorExpected {
  type: string;
  description: string;
}

export interface MalloySQLParseLocation {
  column: number;
  line: number;
  offset: number;
}

export interface MalloySQLParseRange {
  start: MalloySQLParseLocation;
  end: MalloySQLParseLocation;
}

interface ParsedMalloySQLStatement {
  parts: ParsedMalloySQLStatementPart[];
  location: MalloySQLParseRange;
  controlLineLocation: MalloySQLParseRange;
  statementText: string;
  statementType: 'sql' | 'malloy';
  config: string;
}

interface ParsedMalloySQLMalloyStatementPart {
  type: 'malloy';
  text: string;
  location: MalloySQLParseLocation;
  parenthized: boolean;
}

interface ParsedMalloySQLOtherStatementPart {
  type: 'comment' | 'other';
  text: string;
  location: MalloySQLParseLocation;
}

type ParsedMalloySQLStatementPart =
  | ParsedMalloySQLMalloyStatementPart
  | ParsedMalloySQLOtherStatementPart;

interface MalloySQLParseResults {
  initialComments: string;
  statements: ParsedMalloySQLStatement[];
}

export interface MalloySQLStatmentConfig {
  connection: string;
}

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

// TODO record initial non-comment part, don't want to add "Run" button to comments
export class MalloySQLStatement {
  constructor(
    public statementText: string,
    public config: MalloySQLStatmentConfig,
    public location: MalloySQLParseRange
  ) {}
}

interface EmbeddedMalloyQuery {
  query: string;
  //location:
  parenthized: boolean;
}

export class MalloySQLSQLStatement extends MalloySQLStatement {
  public embeddedMalloyQueries: EmbeddedMalloyQuery[];

  constructor(
    public statementText: string,
    public config: MalloySQLStatmentConfig,
    public location: MalloySQLParseRange,
    embeddedMalloyQueries: EmbeddedMalloyQuery[]
  ) {
    super(statementText, config, location);
    this.embeddedMalloyQueries = embeddedMalloyQueries;
  }
}

export class MalloySQLMalloyStatement extends MalloySQLStatement {}

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

    const totalLines = document.split(/\r\n|\r|\n/).length;

    if (!parsed.statements) return [];

    let previousConnection = '';
    const statements = parsed.statements.map(parsedStatement => {
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
        config = JSON.parse(parsedStatement.config);
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

      if (parsedStatement.statementType == 'malloy') {
        return new MalloySQLMalloyStatement(
          parsedStatement.statementText,
          config,
          parsedStatement.location
        );
      } else {
        const embeddedMalloyQueries = parsedStatement.parts
          .filter((part): part is ParsedMalloySQLMalloyStatementPart => {
            return part.type === 'malloy';
          })
          .map(part => {
            return {query: part.text, parenthized: part.parenthized};
          });

        return new MalloySQLSQLStatement(
          parsedStatement.statementText,
          config,
          parsedStatement.location,
          embeddedMalloyQueries
        );
      }
    });

    return statements;
  }
}
