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

import {DataColumn, Explore, Field} from '@malloydata/malloy';
import {Renderer} from '../renderer';
import {createErrorElement} from './utils';
import {JSONRenderOptions, StyleDefaults} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {RendererFactory} from '../renderer_factory';

export class HTMLJSONRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(table: DataColumn): Promise<HTMLElement> {
    if (!table.isArray() && !table.isRecord()) {
      createErrorElement(this.document, 'Invalid data for chart renderer.');
    }

    const element = this.document.createElement('pre');
    element.appendChild(
      this.document.createTextNode(JSON.stringify(table.value, undefined, 2))
    );
    return element;
  }
}

export class JSONRendererFactory extends RendererFactory<JSONRenderOptions> {
  public static readonly instance = new JSONRendererFactory();



  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    _options: JSONRenderOptions
  ): Renderer {
    return new HTMLJSONRenderer(document);
  }

  get rendererName() {
    return 'json';
  }
}
