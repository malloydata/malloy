/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TextDocument} from 'vscode-languageserver-textdocument';
import type {Parse} from '@malloydata/malloy';
import {Malloy} from '@malloydata/malloy';
import type {MalloySQLParse, MalloySQLSQLParse} from '@malloydata/malloy-sql';
import {MalloySQLParser, MalloySQLSQLParser} from '@malloydata/malloy-sql';

const PARSE_CACHE = new Map<string, {parsed: Parse; version: number}>();
const MALLOYSQL_PARSE_CACHE = new Map<
  string,
  {parsed: MalloySQLParse; version: number}
>();
const MALLOYSQLSQL_PARSE_CACHE = new Map<
  string,
  {parsed: MalloySQLSQLParse; version: number}
>();

export const parseWithCache = (document: TextDocument): Parse => {
  const {version, uri} = document;

  const entry = PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = Malloy.parse({source: document.getText()});
  PARSE_CACHE.set(uri, {parsed, version});
  return parsed;
};

export const parseMalloySQLWithCache = (
  document: TextDocument
): MalloySQLParse => {
  const {version, uri} = document;

  const entry = MALLOYSQL_PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = MalloySQLParser.parse(document.getText(), uri);
  MALLOYSQL_PARSE_CACHE.set(uri, {parsed, version});
  return parsed;
};

export const parseMalloySQLSQLWithCache = (
  document: TextDocument
): MalloySQLSQLParse => {
  const {version, uri} = document;

  const entry = MALLOYSQLSQL_PARSE_CACHE.get(uri);
  if (entry && entry.version === version) {
    return entry.parsed;
  }

  const parsed = MalloySQLSQLParser.parse(document.getText(), uri);
  MALLOYSQLSQL_PARSE_CACHE.set(uri, {parsed, version});
  return parsed;
};
