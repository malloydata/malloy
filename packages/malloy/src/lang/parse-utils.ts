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

type AnnotationWarn = (cx: ParserRuleContext, msg: string) => void;

function stripBlockIndent(
  lines: string[],
  column: number,
  cx: ParserRuleContext,
  warn?: AnnotationWarn
): string {
  if (column === 0) {
    return lines.join('');
  }
  const prefix = ' '.repeat(column);
  let warnedLeft = false;
  let warnedTab = false;
  return lines
    .map(line => {
      if (warn && !warnedTab && line.slice(0, column).includes('\t')) {
        warn(cx, 'Block annotation indentation contains tabs, use spaces');
        warnedTab = true;
      }
      if (line.startsWith(prefix)) {
        return line.slice(column);
      }
      if (warn && !warnedLeft && !warnedTab && line.match(/\S/)) {
        warn(cx, 'Block annotation content is left of the opening #|');
        warnedLeft = true;
      }
      return line;
    })
    .join('');
}

function stripTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s.slice(0, -1) : s;
}

export function getAnnotationText(
  cx: AnnotationContext | DocAnnotationContext,
  warn?: AnnotationWarn
): string {
  if (cx instanceof AnnotationContext) {
    const annot = cx.ANNOTATION();
    if (annot) return annot.text;
    const block = cx.blockAnnotation()!;
    const beginToken = block.BLOCK_ANNOTATION_BEGIN();
    const textLines = block.BLOCK_ANNOTATION_TEXT().map(t => t.text);
    return stripTrailingNewline(
      beginToken.text +
        stripBlockIndent(
          textLines,
          beginToken.symbol.charPositionInLine,
          cx,
          warn
        )
    );
  }
  const doc = cx.DOC_ANNOTATION();
  if (doc) return doc.text;
  const block = cx.docBlockAnnotation()!;
  const beginToken = block.DOC_BLOCK_ANNOTATION_BEGIN();
  const textLines = block.BLOCK_ANNOTATION_TEXT().map(t => t.text);
  return stripTrailingNewline(
    beginToken.text +
      stripBlockIndent(
        textLines,
        beginToken.symbol.charPositionInLine,
        cx,
        warn
      )
  );
}
