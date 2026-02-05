/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TagParse, TagError} from '../tags';
import {Tag} from '../tags';
import {Interpreter} from './interpreter';
import type {TagStatement} from './statements';
import * as parser from './dist/peg-tag-parser';

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
  const tag = interpreter.execute(statements, extending);

  return {tag, log: errors};
}

/**
 * Parse Malloy tag language into a Tag which can be queried.
 *
 * @param source - A single string or array of strings to parse. If a string
 *   starts with #, all characters up to the first space are skipped.
 *   When an array is provided, strings are parsed sequentially and merged.
 * @param extending - A tag which this parse will extend
 * @returns TagParse with the resulting tag and any errors. For arrays,
 *   error line numbers indicate the index in the array where the error occurred.
 */
export function parseTag(source: string | string[], extending?: Tag): TagParse {
  if (typeof source === 'string') {
    return parseTagLine(source, extending);
  }

  const allErrs: TagError[] = [];
  let current: Tag | undefined = extending;
  for (let i = 0; i < source.length; i++) {
    const text = source[i];
    const noteParse = parseTagLine(text, current);
    current = noteParse.tag;
    // Adjust error line to be the index in the array
    for (const err of noteParse.log) {
      allErrs.push({...err, line: i + err.line});
    }
  }
  return {tag: current ?? new Tag({}), log: allErrs};
}
