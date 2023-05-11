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

interface MalloySQLStatement {
  parts: MalloySQLStatementPart[];
  location: MalloySQLParseRange;
  statementText: string;
  statementType: 'sql' | 'malloy';
  config: string;
}

interface MalloySQLMalloyStatementPart {
  type: 'malloy';
  text: string;
  location: MalloySQLParseLocation;
  parenthized: boolean;
}

interface MalloySQLOtherStatementPart {
  type: 'comment' | 'other';
  text: string;
  location: MalloySQLParseLocation;
}

type MalloySQLStatementPart =
  | MalloySQLMalloyStatementPart
  | MalloySQLOtherStatementPart;

interface MalloySQLStatementParseResults {
  initialComments: string;
  statements: MalloySQLStatement[];
}

export class MalloySQLParseError extends Error {
  public expected: MalloySQLParseErrorExpected[];
  public found: string;
  public location: MalloySQLParseRange;

  constructor(message: string | undefined, expected, found, location) {
    super(message);
    this.expected = expected;
    this.found = found;
    this.location = location;
  }
}

export class MalloySQLConfigurationError extends Error {}

export class MalloySQLParser {
  constructor() {}

  public parse(document: string) {
    let parsed: [MalloySQLStatementParseResults[]];
    try {
      parsed = parser.parse(document);
    } catch (e) {
      throw new MalloySQLParseError(e.message, e.expected, e.found, e.location);
    }

    const totalLines = document.split(/\r\n|\r|\n/).length;
    const initialComments = parsed.shift();
    const statements = parsed.shift();

    if (!statements) return; // TODO

    for (const statement of statements) {
      console.log(statement);
    }

    return parsed;
  }
}
