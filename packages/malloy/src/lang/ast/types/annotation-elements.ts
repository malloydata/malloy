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

import {MalloyTagProperties, parseTagProperties} from '../../../tags';
import {Document, DocStatement, MalloyElement} from './malloy-element';
import {QueryPropertyInterface} from './query-property-interface';

export class ObjectAnnotation
  extends MalloyElement
  implements QueryPropertyInterface
{
  elementType = 'annotation';
  forceQueryClass = undefined;
  queryRefinementStage = undefined;

  constructor(readonly notes: string[]) {
    super();
  }

  queryExecute() {}
}

export class ModelAnnotation extends ObjectAnnotation implements DocStatement {
  elementType = 'modelAnnotation';

  getCompilerFlags(existing: MalloyTagProperties): MalloyTagProperties {
    let flags = {...existing};
    for (const note of this.notes) {
      if (note.startsWith('##! ')) {
        const parsed = parseTagProperties(note.slice(4), flags);
        if (parsed) {
          flags = parsed;
        }
      }
    }
    return flags;
  }

  execute(doc: Document): void {
    doc.notes = doc.notes.concat(this.notes);
  }
}
