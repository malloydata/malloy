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

import {ParserRuleContext} from 'antlr4ts';
import {
  StringContext,
  ShortStringContext,
  SqlStringContext,
  IsDefineContext,
  IdContext,
} from './lib/Malloy/MalloyParser';
import {TerminalNode} from 'antlr4ts/tree/TerminalNode';

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
    return parseString(str, str[0]);
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

export type HasString = ParserRuleContext & {
  string: () => StringContext;
};
type StringPart = ParserRuleContext | string;

export function getStringParts(cx: SqlStringContext): StringPart[] {
  if (cx) {
    const strParts: StringPart[] = [];
    for (const part of cx.sqlInterpolation()) {
      const upToOpen = part.OPEN_CODE().text;
      if (upToOpen.length > 2) {
        strParts.push(upToOpen.slice(0, upToOpen.length - 2));
      }
      if (part.query()) {
        strParts.push(part.query());
      }
    }
    const lastChars = cx.SQL_END()?.text.slice(0, -3);
    if (lastChars && lastChars.length > 0) {
      strParts.push(lastChars);
    }
    return strParts;
  }
  return [];
}

enum ParseState {
  Normal,
  ReverseVirgule,
  Unicode,
}

/**
 * Parses the interior of a string, doing all \ substitutions. In most cases
 * a lexical analyzer has already recognized this as a string. As a convenience,
 * strip off the quoting outer chartacters if asked, then parse the interior of
 * the string. The intention is to be compatible with JSON strings, in terms
 * of which \X substitutions are processed.
 * @param str is the string to parse
 * @param surround is the quoting character, default means quotes already stripped
 * @returns a string with the \ processing completed
 */
export function parseString(str: string, surround = ''): string {
  let inner = str.slice(surround.length);
  let state = ParseState.Normal;
  if (surround.length) {
    inner = inner.slice(0, -surround.length);
  }
  let out = '';
  let unicode = '';
  for (const c of inner) {
    switch (state) {
      case ParseState.Normal: {
        if (c === '\\') {
          state = ParseState.ReverseVirgule;
        } else {
          out += c;
        }
        break;
      }
      case ParseState.ReverseVirgule: {
        let outc = c;
        if (c === 'u') {
          state = ParseState.Unicode;
          unicode = '';
          continue;
        }
        if (c === 'b') {
          outc = '\b';
        } else if (c === 'f') {
          outc = '\f';
        } else if (c === 'n') {
          outc = '\n';
        } else if (c === 'r') {
          outc = '\r';
        } else if (c === 't') {
          outc = '\t';
        }
        out += outc;
        state = ParseState.Normal;
        break;
      }
      case ParseState.Unicode: {
        if ('ABCDEFabcdef0123456789'.includes(c)) {
          unicode += c;
          if (unicode.length === 4) {
            out += String.fromCharCode(parseInt(unicode, 16));
            state = ParseState.Normal;
          }
        } else {
          // Don't think we ever get here ...
          state = ParseState.Normal;
        }
      }
    }
  }
  return out;
}

type HasAnnotations = ParserRuleContext & {ANNOTATION: () => TerminalNode[]};
/**
 * Get all the possibly missing annotations from this parse rule
 * @param cx Any parse context which has an ANNOTATION* rules
 * @returns Array of texts for the annotations
 */
export function getNotes(cx: HasAnnotations): string[] {
  return cx.ANNOTATION().map(a => a.text);
}

export function getIsNotes(cx: IsDefineContext): string[] {
  const before = getNotes(cx._beforeIs);
  return before.concat(getNotes(cx._afterIs));
}

export type HasID = ParserRuleContext & {id: () => IdContext};

/**
 * An identifier is either a sequence of id characters or a `quoted`
 * This parses either to simply the resulting text.
 * @param cx A context which has an identifier
 * @returns The indenftifier text
 */
export function getId(cx: HasID): string {
  const quoted = cx.id().BQ_STRING();
  if (quoted) {
    return parseString(quoted.text, '`');
  }
  return cx.id().text;
}

export function getOptionalId(cx: ParserRuleContext): string | undefined {
  function containsID(cx: ParserRuleContext): cx is HasID {
    return 'id' in cx;
  }
  if (containsID(cx) && cx.id()) {
    return getId(cx);
  }
}
