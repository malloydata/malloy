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
 * @param onLine - Line number for error reporting
 * @returns TagParse with the resulting tag and any errors
 */
export function parseTagLine(
  source: string,
  extending: Tag | undefined,
  onLine: number
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
      errors.push({
        code: 'tag-parse-syntax-error',
        message: peggyError.message,
        line: onLine,
        offset: peggyError.location.start.column - 1,
      });
    } else {
      errors.push({
        code: 'tag-parse-syntax-error',
        message: String(e),
        line: onLine,
        offset: 0,
      });
    }
    return {tag: extending?.clone() ?? new Tag({}), log: errors};
  }

  const interpreter = new Interpreter();
  const result = interpreter.execute(statements, extending);

  // Convert interpreter errors to TagErrors
  for (const err of result.errors) {
    errors.push({
      code: err.code,
      message: err.message,
      line: onLine,
      offset: 0,
    });
  }

  return {tag: result.tag, log: errors};
}

export type {TagStatement, TagValue, ArrayElement} from './statements';
export {Interpreter} from './interpreter';
export type {InterpreterError, InterpreterResult} from './interpreter';
