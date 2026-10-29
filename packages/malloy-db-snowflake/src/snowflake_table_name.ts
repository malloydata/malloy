/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Parses Snowflake table references of the form
//   [database.][schema.]table
// where each part is either a bare identifier (case-insensitive, stored
// upper-cased in Snowflake's catalog) or a double-quoted identifier
// (case-sensitive, with `""` as the in-string escape for a literal `"`).
//
// The parser exists so the INFORMATION_SCHEMA.TABLES size probe can compare
// `table_schema` / `table_name` against the correct catalog value:
// bare names must be upper-cased, quoted names must be passed through
// verbatim. The old `split('.')` + regex approach got this wrong for
// quoted names and names with embedded dots.

import {TinyParser} from '@malloydata/malloy/internal';

export interface SnowflakeIdentPart {
  /** Normalized catalog value — suitable for a SQL string literal. */
  literal: string;
  /** Re-emission form — suitable for a SQL identifier position. */
  sql: string;
  quoted: boolean;
}

export interface ParsedSnowflakeTableName {
  database?: SnowflakeIdentPart;
  schema?: SnowflakeIdentPart;
  table: SnowflakeIdentPart;
}

class SnowflakeTableNameParser extends TinyParser {
  constructor(input: string) {
    super(input, {
      space: /^\s+/,
      char: /^\./,
      qstr: /^"(?:[^"]|"")*"/,
      ident: /^[A-Za-z_][A-Za-z0-9_$]*/,
    });
  }

  parts(): SnowflakeIdentPart[] {
    const out: SnowflakeIdentPart[] = [this.readPart()];
    while (this.match('.')) {
      out.push(this.readPart());
    }
    if (!this.eof()) {
      throw this.parseError(`Unexpected ${this.peek().type}`);
    }
    return out;
  }

  private readPart(): SnowflakeIdentPart {
    const quoted = this.match('qstr');
    if (quoted) {
      // qstr strips outer quotes; `""` inside is the Snowflake escape.
      const literal = quoted.text.replace(/""/g, '"');
      return {
        literal,
        sql: `"${literal.replace(/"/g, '""')}"`,
        quoted: true,
      };
    }
    const ident = this.match('ident');
    if (ident) {
      const literal = ident.text.toUpperCase();
      return {literal, sql: literal, quoted: false};
    }
    throw this.parseError('Expected identifier');
  }
}

/**
 * Parse a Snowflake table reference into 1-3 identifier parts. Returns
 * undefined when the input is not a well-formed `[db.][schema.]table`
 * reference — callers should treat that as "unknown shape" and skip
 * metadata-driven optimizations rather than guessing.
 */
export function parseSnowflakeTableName(
  src: string
): ParsedSnowflakeTableName | undefined {
  try {
    const parts = new SnowflakeTableNameParser(src).parts();
    if (parts.length < 1 || parts.length > 3) return undefined;
    if (parts.length === 1) return {table: parts[0]};
    if (parts.length === 2) return {schema: parts[0], table: parts[1]};
    return {database: parts[0], schema: parts[1], table: parts[2]};
  } catch {
    return undefined;
  }
}
