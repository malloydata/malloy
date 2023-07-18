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

import {Annotation} from './model';

export type MalloyTagProperties = Record<string, string | boolean>;
interface PropertyTag {
  properties: MalloyTagProperties;
}
interface DocTag {
  docString: string;
}
type MalloyTag = DocTag | PropertyTag;
function isDocTag(a: MalloyTag | undefined): a is DocTag {
  return (a as DocTag)?.docString !== undefined;
}

export interface MalloyTags extends PropertyTag {
  docStrings: string[];
}

export interface Taggable {
  getTags: () => Tags;
}

/**
 * Collection of useful functions for handing tag data ...
 */
export class Tags {
  private tags: Annotation | undefined;
  constructor(annotation: Annotation | undefined) {
    this.tags = annotation;
  }

  getMalloyTags(): MalloyTags {
    const ret: MalloyTags = {docStrings: [], properties: {}};
    for (const tagLine of tagList(this.tags)) {
      const tag = parseTag(tagLine, ret.properties);
      if (isDocTag(tag)) {
        ret.docStrings.push(tag.docString);
      }
    }
    return ret;
  }

  getTagList(): string[] {
    return tagList(this.tags);
  }
}

function tagList(tagNode: Annotation | undefined): string[] {
  if (!tagNode) {
    return [];
  }
  return [
    ...(tagNode.inherits ? tagList(tagNode.inherits) : []),
    ...(tagNode.blockNotes || []),
    ...(tagNode.notes || []),
  ];
}

/**
 * Lines which start '#"' are doc strings
 * Lines which start '# ' are property lines ... The property parser is
 * pretty simple, the langauge is:
 * Property can be
 *   name       -- set the value to "true"
 *   -name      -- delete a value from the property
 *   name=value -- assign value to the name
 * Name can be any sequence of non space characters, or a string
 * A value is any sequence of non space characters, or a string
 * A string is " enclosing and ending in " with \" allowed inside
 */
function parseTag(
  src: string,
  tagProp: MalloyTagProperties
): MalloyTag | undefined {
  const docMatch = src.match(/^##?" /);
  if (docMatch) {
    return {docString: src.slice(docMatch[0].length)};
  }
  const propMatch = src.match(/^##? /);
  if (!propMatch) {
    return;
  }
  const newProps = parseTagProperties(src.slice(propMatch[0].length), tagProp);
  if (newProps) {
    return {properties: newProps};
  }
}

export function parseTagProperties(
  src: string,
  tagProp: MalloyTagProperties
): MalloyTagProperties | undefined {
  /*
   * I went back and forth if the grammar for these annotations should be
   * in the parser or the lexer. Eventually the fact that the lexer ate
   * newlines meant I couldn't figure out how to do it in the parser.
   *
   * Seems wrong to be writing a parser though.
   */
  const tokens = tokenize(src);
  let tn = 0;
  const lastToken = tokens.length - 1;
  while (tn <= lastToken) {
    let token = tokens[tn];
    if (token === '=') {
      return undefined;
    }
    if (token[0] === '"') {
      token = token.slice(1, -1);
    }
    if (tn !== lastToken && tokens[tn + 1] === '=') {
      if (tn + 2 <= lastToken) {
        let value = tokens[tn + 2];
        if (value !== '=') {
          if (value[0] === '"') {
            value = value.slice(1, -1);
          }
          tagProp[token] = value;
          tn += 3;
          continue;
        }
      }
      return undefined;
    }
    if (token.startsWith('-')) {
      delete tagProp[token.slice(1)];
    } else {
      tagProp[token] = true;
    }
    tn += 1;
  }
  return tagProp;
}

function tokenize(src: string): string[] {
  const parts: string[] = [];
  src = src.trim();
  while (src) {
    const skipSpace = src.match(/^\s*(.+$)/);
    if (skipSpace === null) {
      break;
    }
    src = skipSpace[1];
    if (src[0] === '=') {
      parts.push('=');
      src = src.slice(1);
      continue;
    }
    if (src[0] === '"') {
      const matchString = src.match(/^"(\\"|[^"])*"/);
      if (!matchString) {
        break;
      }
      parts.push(matchString[0].replace(/\\"/g, '"'));
      src = src.slice(matchString[0].length);
      continue;
    }
    const token = src.match(/^[^\s "=]+/);
    if (token) {
      parts.push(token[0]);
      src = src.slice(token[0].length);
      continue;
    }
    break;
  }
  return parts;
}
