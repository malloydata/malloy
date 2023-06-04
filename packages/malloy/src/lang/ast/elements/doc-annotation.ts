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

import {Annotation} from '../../../model/malloy_types';
import {ModelDataRequest} from '../../translate-response';
import {
  Document,
  DocStatement,
  ObjectAnnotation,
} from '../types/malloy-element';

export interface Noteable {
  isNoteable: true;
  setAnnotation(note: Annotation): void;
  getAnnotation(): Annotation;
}
export function isNoteable(el: unknown): el is Noteable {
  return (el as Noteable).isNoteable;
}

// interface DocAnnotation {
//   docString: string;
// }
// type AnnotationProperties = Record<string, string | boolean>;
// interface PropertyAnnotation {
//   properties: AnnotationProperties;
// }
// export type Annote = DocAnnotation | PropertyAnnotation;
// export function isDocType(a: Annote | undefined): a is DocAnnotation {
//   return (a as DocAnnotation)?.docString !== undefined;
// }
// export function isPropType(a: Annote | undefined): a is PropertyAnnotation {
//   return (a as PropertyAnnotation)?.properties !== undefined;
// }

// function tokenize(src: string): string[] {
//   const parts: string[] = [];
//   while (src) {
//     const skipSpace = src.match(/^\s*(.+$)/);
//     if (skipSpace === null) {
//       break;
//     }
//     src = skipSpace[1];
//     if (src[0] === '=') {
//       parts.push('=');
//       src = src.slice(1);
//       continue;
//     }
//     if (src[0] === '"') {
//       const matchString = src.match(/^"(\\"|[^"])*"/);
//       if (!matchString) {
//         break;
//       }
//       parts.push(matchString[0]);
//       src = src.slice(matchString[0].length);
//       continue;
//     }
//     const token = src.match(/^[^\s "=]+/);
//     if (token) {
//       parts.push(token[0]);
//       src = src.slice(token[0].length);
//       continue;
//     }
//     break;
//   }
//   return parts;
// }
// static make(src: string): ObjectAnnotation | undefined {
//   if (src.startsWith('#" ')) {
//     return new ObjectAnnotation({docString: src.slice(3)});
//   }
//   if (!src.startsWith('# ')) {
//     return;
//   }
//   /*
//    * I went back and forth if the grammar for these annotations should be
//    * in the parser or the lexer. Eventually the fact that the lexer ate
//    * newlines meant I couldn't figure out how to do it in the parser.
//    *
//    * Seems wrong to be writing a parser though.
//    */
//   const tokens = tokenize(src.slice(2));
//   let tn = 0;
//   const lastToken = tokens.length - 1;
//   const properties: AnnotationProperties = {};
//   while (tn <= lastToken) {
//     let token = tokens[tn];
//     if (token === '=') {
//       return undefined;
//     }
//     if (token[0] === '"') {
//       token = token.slice(1, -1);
//     }
//     if (tn !== lastToken && tokens[tn + 1] === '=') {
//       if (tn + 2 <= lastToken) {
//         let value = tokens[tn + 2];
//         if (value !== '=') {
//           if (value[0] === '"') {
//             value = value.slice(1, -1);
//           }
//           properties[token] = value;
//           tn += 3;
//           continue;
//         }
//       }
//       return undefined;
//     }
//     properties[token] = true;
//     tn += 1;
//   }
//   return new ObjectAnnotation({properties});
// }

export class TODO_DELETE_ME_DocAnnotation
  extends ObjectAnnotation
  implements DocStatement
{
  elementType = 'no model element annotation';
  execute(_doc: Document): ModelDataRequest {
    return;
  }
}
