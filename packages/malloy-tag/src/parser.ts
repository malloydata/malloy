/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  MOTLYError,
  MOTLYNode,
  MOTLYValue,
} from '@malloydata/motly-ts-parser';
import {MOTLYSession} from '@malloydata/motly-ts-parser';
import {Tag, RefTag} from './tags';
import type {TagParse, TagError, Path} from './tags';

/**
 * Strip the Malloy tag prefix (e.g., "# " or "#(docs) ") from source.
 */
function stripPrefix(source: string): string {
  if (source[0] === '#') {
    const skipTo = source.indexOf(' ');
    if (skipTo > 0) {
      return source.slice(skipTo);
    }
    return '';
  }
  return source;
}

/**
 * Map a MOTLYError (from motly-ts parser) to a TagError.
 */
function mapMOTLYError(error: MOTLYError): TagError {
  return {
    code: error.code,
    message: error.message,
    line: error.begin.line,
    offset: error.begin.column,
  };
}

/**
 * Parse a reference string like "$^^path.to[0].thing" back into
 * structured form {ups, refPath}.
 */
function parseRefString(linkTo: string): {ups: number; refPath: Path} {
  let i = 1;
  let ups = 0;
  while (i < linkTo.length && linkTo[i] === '^') {
    ups++;
    i++;
  }

  const refPath: Path = [];
  const rest = linkTo.slice(i);

  if (rest.length === 0) {
    return {ups, refPath};
  }

  let pos = 0;
  let needDot = false;

  while (pos < rest.length) {
    if (rest[pos] === '.') {
      pos++;
      needDot = false;
      continue;
    }

    if (rest[pos] === '[') {
      const close = rest.indexOf(']', pos);
      refPath.push(Number(rest.slice(pos + 1, close)));
      pos = close + 1;
      needDot = true;
      continue;
    }

    if (needDot) {
      // Expected a dot separator but didn't get one
    }

    if (rest[pos] === '`') {
      pos++;
      let seg = '';
      while (pos < rest.length && rest[pos] !== '`') {
        if (rest[pos] === '\\') {
          pos++;
          seg += rest[pos];
        } else {
          seg += rest[pos];
        }
        pos++;
      }
      pos++;
      refPath.push(seg);
      needDot = true;
      continue;
    }

    let seg = '';
    while (
      pos < rest.length &&
      rest[pos] !== '.' &&
      rest[pos] !== '[' &&
      rest[pos] !== '`'
    ) {
      seg += rest[pos];
      pos++;
    }
    if (seg.length > 0) {
      refPath.push(seg);
      needDot = true;
    }
  }

  return {ups, refPath};
}

function isRef(node: MOTLYNode): node is {linkTo: string} {
  return 'linkTo' in node;
}

/**
 * Convert a MOTLYNode tree into a Tag tree with parent links.
 */
function hydrate(node: MOTLYNode, parent?: Tag): Tag {
  if (isRef(node)) {
    const {ups, refPath} = parseRefString(node.linkTo);
    return new RefTag(ups, refPath, parent);
  }

  const tag = new Tag({}, parent);

  if (node.eq !== undefined) {
    if (Array.isArray(node.eq)) {
      tag.eq = node.eq.map(el => hydrate(el, tag));
    } else if (node.eq instanceof Date) {
      tag.eq = new Date(node.eq);
    } else {
      tag.eq = node.eq;
    }
  }

  if (node.properties !== undefined) {
    tag.properties = {};
    for (const [key, val] of Object.entries(node.properties)) {
      tag.properties[key] = hydrate(val, tag);
    }
  }

  if (node.deleted) {
    tag.deleted = true;
  }

  return tag;
}

/**
 * Convert a Tag tree into a MOTLYNode tree.
 */
function dehydrate(tag: Tag): MOTLYNode {
  if (tag instanceof RefTag) {
    return {linkTo: tag.toRefString()};
  }

  const result: MOTLYValue = {};

  if (tag.eq !== undefined) {
    if (Array.isArray(tag.eq)) {
      result.eq = tag.eq.map(el => dehydrate(el));
    } else if (tag.eq instanceof Date) {
      result.eq = new Date(tag.eq);
    } else {
      result.eq = tag.eq;
    }
  }

  if (tag.properties !== undefined) {
    result.properties = {};
    for (const [key, val] of Object.entries(tag.properties)) {
      result.properties[key] = dehydrate(val);
    }
  }

  if (tag.deleted) {
    result.deleted = true;
  }

  return result;
}

/**
 * Session-based parser for Malloy tag language. Create an instance,
 * call parse() for each line, then finish() to get the final Tag.
 */
export class TagParser {
  private session: MOTLYSession;

  constructor(extending?: Tag) {
    this.session = new MOTLYSession();
    if (extending) {
      (this.session as unknown as {value: MOTLYValue}).value = dehydrate(
        extending
      ) as MOTLYValue;
    }
  }

  parse(source: string): TagParse {
    const stripped = stripPrefix(source);
    const errors = this.session.parse(stripped);
    const tagErrors = errors.map(mapMOTLYError);
    const value = this.session.getValue();
    return {tag: hydrate(value), log: tagErrors};
  }

  finish(): Tag {
    const value = this.session.getValue();
    this.session.dispose();
    return hydrate(value);
  }
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
  const session = new TagParser(extending);
  if (typeof source === 'string') {
    return session.parse(source);
  }

  const allErrs: TagError[] = [];
  for (let i = 0; i < source.length; i++) {
    const result = session.parse(source[i]);
    for (const err of result.log) {
      allErrs.push({...err, line: i + err.line});
    }
  }
  return {tag: session.finish(), log: allErrs};
}
