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
