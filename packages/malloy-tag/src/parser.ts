/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  MOTLYError,
  MOTLYLocation,
  MOTLYNode,
} from '@malloydata/motly-ts-parser';
import {MOTLYSession, isRef, isEnvRef} from '@malloydata/motly-ts-parser';
import {Tag} from './tags';
import type {TagParse, TagError, TagLocation} from './tags';

/**
 * Where a MOTLY fragment came from in the host source.
 * Used to resolve MOTLY-relative positions to absolute source locations.
 */
export interface SourceOrigin {
  url: string;
  startLine: number;
  startColumn: number;
}

/**
 * Strip the Malloy annotation prefix (e.g., "# " or "#(docs) ") from source.
 * Annotation text starts with # followed by routing characters and a
 * space or newline delimiter. Everything up to and including that delimiter
 * is stripped, leaving just the MOTLY content.
 */
function stripPrefix(source: string): string {
  const skipTo = source.search(/[ \n]/);
  if (skipTo > 0) {
    return source.slice(skipTo);
  }
  return '';
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
 * Resolve a MOTLYLocation to a TagLocation using the source origin map.
 */
function resolveLocation(
  loc: MOTLYLocation,
  origins: Map<number, SourceOrigin>
): TagLocation | undefined {
  const origin = origins.get(loc.parseId);
  if (!origin) return undefined;

  return {
    url: origin.url,
    range: {
      start: {
        line: origin.startLine + loc.begin.line,
        character:
          loc.begin.line === 0
            ? origin.startColumn + loc.begin.column
            : loc.begin.column,
      },
      end: {
        line: origin.startLine + loc.end.line,
        character:
          loc.end.line === 0
            ? origin.startColumn + loc.end.column
            : loc.end.column,
      },
    },
  };
}

/**
 * Convert a MOTLYNode (node or ref) into a Tag tree with parent links.
 * Refs are dropped (skipped). Env references (@env.NAME) are resolved
 * from process.env during hydration.
 */
function hydrate(
  pv: MOTLYNode,
  parent?: Tag,
  origins?: Map<number, SourceOrigin>
): Tag {
  if (isRef(pv)) {
    return new Tag({deleted: true}, parent);
  }

  const tag = new Tag({}, parent);

  if (pv.location && origins) {
    tag.location = resolveLocation(pv.location, origins);
  }

  if (pv.eq !== undefined) {
    if (Array.isArray(pv.eq)) {
      tag.eq = pv.eq.map(el => hydrate(el, tag, origins));
    } else if (isEnvRef(pv.eq)) {
      const envVal = process.env[pv.eq.env];
      if (envVal !== undefined) {
        tag.eq = envVal;
      }
    } else if (pv.eq instanceof Date) {
      tag.eq = new Date(pv.eq);
    } else {
      tag.eq = pv.eq;
    }
  }

  if (pv.properties !== undefined) {
    tag.properties = {};
    for (const [key, val] of Object.entries(pv.properties)) {
      tag.properties[key] = hydrate(val, tag, origins);
    }
  }

  if (pv.deleted) {
    tag.deleted = true;
  }

  return tag;
}

/**
 * Session-based parser for Malloy tag language. Create an instance,
 * call parse() or parseAnnotation() for each line, then finish() to
 * get the final Tag.
 */
export class TagParser {
  private session: MOTLYSession;
  private origins = new Map<number, SourceOrigin>();

  constructor() {
    this.session = new MOTLYSession();
  }

  /**
   * Parse raw MOTLY text. No prefix stripping is performed.
   */
  parse(source: string, origin?: SourceOrigin): TagParse {
    return this.parseSource(source, 0, origin);
  }

  /**
   * Parse annotation text (starting with #). The annotation prefix
   * is unconditionally stripped before parsing the MOTLY content.
   */
  parseAnnotation(source: string, origin?: SourceOrigin): TagParse {
    const stripped = stripPrefix(source);
    const prefixLen = source.length - stripped.length;
    return this.parseSource(stripped, prefixLen, origin);
  }

  private parseSource(
    source: string,
    prefixLen: number,
    origin?: SourceOrigin
  ): TagParse {
    const {parseId, errors} = this.session.parse(source);
    if (origin) {
      this.origins.set(parseId, {
        url: origin.url,
        startLine: origin.startLine,
        startColumn: origin.startColumn + prefixLen,
      });
    }
    const tagErrors = errors.map(mapMOTLYError);
    const value = this.session.getValue();
    return {tag: hydrate(value, undefined, this.origins), log: tagErrors};
  }

  finish(): Tag {
    const value = this.session.getValue();
    this.session.dispose();
    return hydrate(value, undefined, this.origins);
  }
}

/**
 * Parse raw MOTLY text into a Tag. No prefix stripping is performed.
 *
 * @param source - A single string or array of strings to parse.
 *   When an array is provided, strings are parsed sequentially and merged.
 * @returns TagParse with the resulting tag and any errors. For arrays,
 *   error line numbers indicate the index in the array where the error occurred.
 */
export function parseTag(source: string | string[]): TagParse {
  const session = new TagParser();
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

/**
 * Parse Malloy annotation text into a Tag. The annotation prefix
 * (e.g., "# ", "#@ ", "#(docs) ") is unconditionally stripped before
 * parsing the MOTLY content.
 *
 * @param source - A single string or array of annotation strings to parse.
 *   When an array is provided, strings are parsed sequentially and merged.
 * @returns TagParse with the resulting tag and any errors. For arrays,
 *   error line numbers indicate the index in the array where the error occurred.
 */
export function parseAnnotation(source: string | string[]): TagParse {
  const session = new TagParser();
  if (typeof source === 'string') {
    return session.parseAnnotation(source);
  }

  const allErrs: TagError[] = [];
  for (let i = 0; i < source.length; i++) {
    const result = session.parseAnnotation(source[i]);
    for (const err of result.log) {
      allErrs.push({...err, line: i + err.line});
    }
  }
  return {tag: session.finish(), log: allErrs};
}
