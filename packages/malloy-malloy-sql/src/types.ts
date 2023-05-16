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

export interface ParsedMalloySQLStatement {
  parts: ParsedMalloySQLStatementPart[];
  location: MalloySQLParseRange;
  controlLineLocation: MalloySQLParseRange;
  statementText: string;
  statementType: 'sql' | 'malloy';
  config: string;
}

export interface ParsedMalloySQLMalloyStatementPart {
  type: 'malloy';
  text: string;
  location: MalloySQLParseRange;
  parenthized: boolean;
}

export interface ParsedMalloySQLOtherStatementPart {
  type: 'comment' | 'other';
  text: string;
  location: MalloySQLParseRange;
}

export type ParsedMalloySQLStatementPart =
  | ParsedMalloySQLMalloyStatementPart
  | ParsedMalloySQLOtherStatementPart;

export interface MalloySQLParseResults {
  initialComments: string;
  statements: ParsedMalloySQLStatement[];
}

export interface MalloySQLStatmentConfig {
  connection: string;
}

export enum MalloySQLStatementType {
  SQL = 'sql',
  MALLOY = 'malloy',
}

export interface MalloySQLStatementBase {
  statementText: string;
  config: MalloySQLStatmentConfig;
  location: MalloySQLParseRange;
  firstNonCommentToken: MalloySQLParseLocation | undefined;
}

export interface EmbeddedMalloyQuery {
  query: string;
  location: MalloySQLParseRange;
  parenthized: boolean;
}

export interface MalloySQLSQLStatement extends MalloySQLStatementBase {
  type: MalloySQLStatementType.MALLOY;
}

export interface MalloySQLMalloyStatement extends MalloySQLStatementBase {
  type: MalloySQLStatementType.SQL;
  statementIndex: number;
  embeddedMalloyQueries: EmbeddedMalloyQuery[];
}

export type MalloySQLStatement =
  | MalloySQLSQLStatement
  | MalloySQLMalloyStatement;
