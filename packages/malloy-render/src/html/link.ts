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
import {createErrorElement, createNullElement} from './utils';
import {LinkRenderOptions, StyleDefaults} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {RendererFactory} from '../renderer_factory';

export class HTMLLinkRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(data: DataColumn): Promise<HTMLElement> {
    if (data.isNull()) {
      return createNullElement(this.document);
    }

    if (!data.isString()) {
      return createErrorElement(
        this.document,
        'Invalid type for link renderer.'
      );
    }

    const element = this.document.createElement('a');
    element.href = data.value;
    element.target = '_blank';
    element.appendChild(
      this.document.createTextNode(data.value.replace(/\//g, '/\u200C'))
    );
    return element;
  }
}

export class LinkRendererFactory extends RendererFactory<LinkRenderOptions> {
  public static readonly instance = new LinkRendererFactory();

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    _options: LinkRenderOptions
  ): Renderer {
    return new HTMLLinkRenderer(document);
  }

  get rendererName() {
    return 'link';
  }
}
