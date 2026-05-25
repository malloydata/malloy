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

import type {ParserRuleContext} from 'antlr4ts';
import type {DocAnnotationContext} from './lib/Malloy/MalloyParser';
import {
  type StringContext,
  type ShortStringContext,
  type SqlStringContext,
  type IdContext,
  AnnotationContext,
} from './lib/Malloy/MalloyParser';
import {ParseUtil} from '@malloydata/malloy-tag';
import type {DocumentLocation, Note} from '../model/malloy_types';
import type {MalloyParseInfo} from './malloy-parse-info';
import {rangeFromContext} from './utils';

/**
 * Take the text of a matched string, including the matching quote
 * characters, and return the actual contents of the string after
 * \ processing.
 * @param cx Any parse context which contains a string
 * @returns Decocded string
 */
export function getShortString(scx: ShortStringContext): string {
  const str = scx.DQ_STRING()?.text || scx.SQ_STRING()?.text;
  if (str) {
    return ParseUtil.parseString(str, str[0]);
  }
  // shortString: DQ_STRING | SQ_STRING; So this will never happen
  return '';
}

export function getStringIfShort(cx: HasString): string | undefined {
  const scx = cx.string().shortString();
  if (scx) {
    return getShortString(scx);
  }
}

export type HasString = {
  string: () => StringContext;
};
type StringPart = ParserRuleContext | string;

export function* getStringParts(cx: SqlStringContext): Generator<StringPart> {
  if (cx) {
    for (const part of cx.sqlInterpolation()) {
      const upToOpen = part.OPEN_CODE().text;
      if (upToOpen.length > 2) {
        yield upToOpen.slice(0, upToOpen.length - 2);
      }
      if (part.sqExpr()) {
        yield part.sqExpr();
      }
    }
    const lastChars = cx.SQL_END()?.text.slice(0, -3);
    if (lastChars && lastChars.length > 0) {
      yield lastChars;
    }
  }
}

export type HasID = ParserRuleContext & {id: () => IdContext};

/**
 * An identifier is either a sequence of id characters or a `quoted`
 * This parses either to simply the resulting text.
 * @param cx A context which has an identifier
 * @returns The indenftifier text
 */
export function getId(cx: HasID): string {
  return idToStr(cx.id());
}
export function idToStr(cx: IdContext): string {
  const quoted = cx.BQ_STRING();
  if (quoted) {
    return ParseUtil.parseString(quoted.text, '`');
  }
  return cx.text;
}

export function getOptionalId(cx: ParserRuleContext): string | undefined {
  function containsID(cx: ParserRuleContext): cx is HasID {
    return 'id' in cx;
  }
  if (containsID(cx) && cx.id()) {
    return getId(cx);
  }
}

function* linesOf(allText: string): Generator<string> {
  while (allText.length > 0) {
    const lineMatch = allText.match(/^.*?\r?\n/);
    let nextLine = allText;
    if (lineMatch) {
      nextLine = lineMatch[0];
    }
    yield nextLine;
    allText = allText.slice(nextLine.length);
  }
}

function minIndent(allText: string) {
  let leftMost: number | undefined;
  for (const line of linesOf(allText)) {
    // look for lines starting with spaces, that have a non blank character somewhere
    const leadingMatch = line.match(/^( *).*[^\s]/);
    if (leadingMatch) {
      const indentBy = leadingMatch[1].length;
      if (leftMost === undefined || indentBy < leftMost) {
        leftMost = indentBy;
      }
    }
  }
  return leftMost;
}

export function unIndent(parts: (string | unknown)[]): void {
  let removeSpaces: number | undefined;
  for (const part of parts) {
    if (typeof part === 'string') {
      const newLeft = minIndent(part);
      if (
        newLeft !== undefined &&
        (removeSpaces === undefined || newLeft < removeSpaces)
      ) {
        removeSpaces = newLeft;
      }
    }
  }
  if (removeSpaces) {
    for (let i = 0; i <= parts.length; i += 1) {
      const ent = parts[i];
      if (typeof ent === 'string') {
        let newEnt = '';
        for (let line of linesOf(ent)) {
          if (line[0] === ' ') {
            line = line.slice(removeSpaces);
          }
          newEnt += line;
        }
        parts[i] = newEnt;
      }
    }
  }
}

/**
 * Returns plain string from string context.
 * @param cx string context
 * @param strictCheck returns undefined if non string part is found.
 * @returns string part and an error list.
 */
export function getPlainString(
  cx: HasString,
  strictCheck = false
): [string | undefined, ParserRuleContext[]] {
  const errorList: ParserRuleContext[] = [];
  const shortStr = getStringIfShort(cx);
  if (shortStr) {
    return [shortStr, errorList];
  }
  const safeParts: string[] = [];
  const multiLineStr = cx.string().sqlString();
  if (multiLineStr) {
    for (const part of getStringParts(multiLineStr)) {
      if (typeof part === 'string') {
        safeParts.push(part);
      } else {
        // Non string part found. Reject this.
        errorList.push(part);
        if (strictCheck) {
          return [undefined, errorList];
        }
      }
    }
    unIndent(safeParts);
    return [safeParts.join(''), errorList];
  }
  // string: shortString | sqlString; So this will never happen
  return ['', errorList];
}

/**
 * Python `textwrap.dedent`-style: find the longest leading-whitespace prefix
 * common to every non-blank body line and strip it from each line that starts
 * with it. Blank (whitespace-only) lines don't constrain the prefix. Returns
 * the stripped text and the number of characters removed per line — the
 * latter is stored on the `Note` so payload-parser error columns can be
 * mapped back to source (`source_col = indentStripped + parser_col`).
 *
 * Replaces an older "strip exactly opener_column spaces" rule that fired
 * warnings for less-indented lines and had no clean column mapping when
 * stripping was inconsistent. Common prefix is uniform per block, so column
 * mapping is one number per block.
 */
function dedentBlockLines(lines: string[]): {
  text: string;
  indentStripped: number;
} {
  let common: string | undefined;
  for (const line of lines) {
    const content = line.replace(/\r?\n$/, '');
    if (!/\S/.test(content)) continue;
    const indent = content.match(/^[ \t]*/)![0];
    if (common === undefined) {
      common = indent;
      continue;
    }
    let n = 0;
    while (n < common.length && n < indent.length && common[n] === indent[n]) {
      n++;
    }
    common = common.slice(0, n);
    if (common === '') break;
  }
  const prefix = common ?? '';
  if (prefix === '') return {text: lines.join(''), indentStripped: 0};
  return {
    text: lines
      .map(line => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
      .join(''),
    indentStripped: prefix.length,
  };
}

function stripTrailingNewline(s: string): string {
  // A trailing line ending may be CRLF or LF — strip either.
  return s.replace(/\r?\n$/, '');
}

/**
 * Annotation note text is normalized to LF line endings, so a block's stored
 * text and content are identical regardless of the source's CRLF/LF style.
 * The lexer keeps the source `\r` in token text (it sits at line ends, after a
 * line's content); this is where it is dropped.
 */
function normalizeEol(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

/**
 * Read the text and dedent amount of an annotation from its parse tree.
 * Internal — public callers want `noteFromAnnotation` or `getAnnotationText`.
 */
function readAnnotation(cx: AnnotationContext | DocAnnotationContext): {
  text: string;
  indentStripped: number;
} {
  if (cx instanceof AnnotationContext) {
    const annot = cx.ANNOTATION();
    if (annot) return {text: normalizeEol(annot.text), indentStripped: 0};
    const block = cx.blockAnnotation()!;
    const beginToken = block.BLOCK_ANNOTATION_BEGIN();
    const textLines = block.BLOCK_ANNOTATION_TEXT().map(t => t.text);
    const dedented = dedentBlockLines(textLines);
    return {
      text: normalizeEol(stripTrailingNewline(beginToken.text + dedented.text)),
      indentStripped: dedented.indentStripped,
    };
  }
  const doc = cx.DOC_ANNOTATION();
  if (doc) return {text: normalizeEol(doc.text), indentStripped: 0};
  const block = cx.docBlockAnnotation()!;
  const beginToken = block.DOC_BLOCK_ANNOTATION_BEGIN();
  const textLines = block.BLOCK_ANNOTATION_TEXT().map(t => t.text);
  const dedented = dedentBlockLines(textLines);
  return {
    text: normalizeEol(stripTrailingNewline(beginToken.text + dedented.text)),
    indentStripped: dedented.indentStripped,
  };
}

/**
 * Build the IR `Note` for an annotation: reads the text, dedents the body if
 * it's a block, and computes the source `at` from the parse context. The
 * single entry point for going from a parse-tree annotation to an IR note.
 */
export function noteFromAnnotation(
  cx: AnnotationContext | DocAnnotationContext,
  parseInfo: MalloyParseInfo
): Note {
  const {text, indentStripped} = readAnnotation(cx);
  const at: DocumentLocation = {
    url: parseInfo.sourceURL,
    range: rangeFromContext(parseInfo.sourceInfo, cx),
  };
  const note: Note = {text, at};
  if (indentStripped > 0) note.indentStripped = indentStripped;
  return note;
}

/** Text-only reader, for callers that don't need an IR `Note`. */
export function getAnnotationText(
  cx: AnnotationContext | DocAnnotationContext
): string {
  return readAnnotation(cx).text;
}
