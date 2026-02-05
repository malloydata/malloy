/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TagParse, TagError} from '../tags';
import {Tag} from '../tags';
import {Interpreter} from './interpreter';
import type {TagStatement} from './statements';
import * as parser from './peg-tag-parser';

/**
 * Parse a line of Malloy tag language into a Tag.
 *
 * @param source - The source line to parse. If the string starts with #,
 *   all characters up to the first space are skipped.
 * @param extending - A tag which this line will extend
 * @returns TagParse with the resulting tag and any errors. Error positions
 *   are 0-based line/offset within the input string (after prefix stripping).
 */
export function parseTagLine(
  source: string,
  extending: Tag | undefined
): TagParse {
  // Skip the prefix if present (e.g., "# " or "#(docs) ")
  if (source[0] === '#') {
    const skipTo = source.indexOf(' ');
    if (skipTo > 0) {
      source = source.slice(skipTo);
    } else {
      source = '';
    }
  }

  const errors: TagError[] = [];
  let statements: TagStatement[] = [];

  try {
    statements = parser.parse(source);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'location' in e && 'message' in e) {
      const peggyError = e as {
        message: string;
        location: {start: {line: number; column: number}};
      };
      // Return 0-based line and offset within the input string
      errors.push({
        code: 'tag-parse-syntax-error',
        message: peggyError.message,
        line: peggyError.location.start.line - 1,
        offset: peggyError.location.start.column - 1,
      });
    } else {
      errors.push({
        code: 'tag-parse-syntax-error',
        message: String(e),
        line: 0,
        offset: 0,
      });
    }
    return {tag: extending?.clone() ?? new Tag({}), log: errors};
  }

  const interpreter = new Interpreter();
  const result = interpreter.execute(statements, extending);

  // Convert interpreter errors to TagErrors
  // Interpreter errors don't have location info, so use 0
  for (const err of result.errors) {
    errors.push({
      code: err.code,
      message: err.message,
      line: 0,
      offset: 0,
    });
  }

  return {tag: result.tag, log: errors};
}

/**
 * Parse a line of Malloy tag language into a Tag which can be queried.
 * @param source - The source line to be parsed. If the string starts with #, then it skips
 *   all characters up to the first space.
 * @param extending - A tag which this line will be extending
 * @returns Something shaped like { tag: Tag, log: ParseErrors[] }. Error positions
 *   are 0-based line/offset within the input string.
 */
export function tagFromLine(source: string, extending?: Tag): TagParse {
  return parseTagLine(source, extending);
}

/**
 * Parse multiple lines of Malloy tag language, merging them into a single Tag.
 * @param lines - The source lines to be parsed. If a string starts with #, then it skips
 *   all characters up to the first space.
 * @param extending - A tag which these lines will be extending
 * @returns Something shaped like { tag: Tag, log: ParseErrors[] }. Error line numbers
 *   indicate the index in the lines array where the error occurred.
 */
export function tagFromLines(lines: string[], extending?: Tag): TagParse {
  const allErrs: TagError[] = [];
  let current: Tag | undefined = extending;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const noteParse = parseTagLine(text, current);
    current = noteParse.tag;
    // Adjust error line to be the index in the lines array
    for (const err of noteParse.log) {
      allErrs.push({...err, line: i + err.line});
    }
  }
  return {tag: current ?? new Tag({}), log: allErrs};
}
