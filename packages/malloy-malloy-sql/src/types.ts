/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DocumentRange} from '@malloydata/malloy';

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
  range: MalloySQLParseRange;
  delimiterRange: MalloySQLParseRange;
  statementText: string;
  statementType: 'sql' | 'malloy' | 'markdown';
  config: string;
}

export interface ParsedMalloySQLMalloyStatementPart {
  type: 'malloy';
  text: string;
  malloy: string;
  range: MalloySQLParseRange;
  malloyRange: MalloySQLParseRange;
  parenthesized: boolean;
}

export interface ParsedMalloySQLOtherStatementPart {
  type: 'comment' | 'other';
  text: string;
  range: MalloySQLParseRange;
}

export type ParsedMalloySQLStatementPart =
  | ParsedMalloySQLMalloyStatementPart
  | ParsedMalloySQLOtherStatementPart;

export interface MalloySQLParseResults {
  initialComments: string;
  statements: ParsedMalloySQLStatement[];
}

export interface MalloySQLSQLParseResults {
  parts: ParsedMalloySQLStatementPart[];
}

export interface MalloySQLStatementConfig {
  connection?: string;
  fromDelimiter?: boolean;
  inheritedConnection?: boolean;
}

export enum MalloySQLStatementType {
  SQL = 'sql',
  MALLOY = 'malloy',
  MARKDOWN = 'markdown',
}

export interface MalloySQLStatementBase {
  index: number;
  text: string;
  config?: MalloySQLStatementConfig;
  range: DocumentRange;
  delimiterRange: DocumentRange;
}

export interface EmbeddedMalloyQuery {
  query: string; // the malloy part only
  text: string; // the entire wrapped embedded malloy text i.e. "(%{ malloy }%)"
  range: DocumentRange; // the entire wrapped embedded malloy, i.e. "(%{ malloy }%)"
  malloyRange: DocumentRange; // the malloy text only, i.e. " malloy "
  parenthesized: boolean;
}

export interface EmbeddedComment {
  text: string;
  range: DocumentRange;
}

export interface MalloySQLMalloyStatement extends MalloySQLStatementBase {
  type: MalloySQLStatementType.MALLOY;
}

export interface MalloySQLSQLStatement extends MalloySQLStatementBase {
  type: MalloySQLStatementType.SQL;
  index: number;
  embeddedMalloyQueries: EmbeddedMalloyQuery[];
}

export interface MalloySQLMarkdownStatement extends MalloySQLStatementBase {
  type: MalloySQLStatementType.MARKDOWN;
}

export type MalloySQLStatement =
  | MalloySQLSQLStatement
  | MalloySQLMalloyStatement
  | MalloySQLMarkdownStatement;
