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

import {CommonTokenStream, ParserRuleContext} from 'antlr4ts';
import {ParseTreeWalker} from 'antlr4ts/tree/ParseTreeWalker';
import {MalloyParserListener} from '../lib/Malloy/MalloyParserListener';
import * as parser from '../lib/Malloy/MalloyParser';
import {MalloyTranslation} from '../parse-malloy';
import {Annotation, DocumentLocation, Note} from '../../model/malloy_types';
import {MalloyParseInfo} from '../malloy-parse-info';

class ModelAnnotationWalker implements MalloyParserListener {
  private readonly notes: Note[] = [];
  constructor(
    readonly translator: MalloyTranslation,
    readonly tokens: CommonTokenStream,
    private readonly parseInfo: MalloyParseInfo
  ) {}

  protected getLocation(cx: ParserRuleContext): DocumentLocation {
    return {
      url: this.parseInfo.sourceURL,
      range: this.parseInfo.rangeFromContext(cx),
    };
  }

  enterDocAnnotations(pcx: parser.DocAnnotationsContext): void {
    const allNotes = pcx.DOC_ANNOTATION().map(note => {
      return {
        text: note.text,
        at: this.getLocation(pcx),
      };
    });
    this.notes.push(...allNotes);
  }

  get annotation(): Annotation {
    return {notes: this.notes};
  }
}

export function walkForModelAnnotation(
  forParse: MalloyTranslation,
  tokens: CommonTokenStream,
  parseInfo: MalloyParseInfo
): Annotation {
  const finder = new ModelAnnotationWalker(forParse, tokens, parseInfo);
  const listener: MalloyParserListener = finder;
  ParseTreeWalker.DEFAULT.walk(listener, parseInfo.root);
  return finder.annotation;
}
