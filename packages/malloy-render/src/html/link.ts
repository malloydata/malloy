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

import type {Renderer} from './renderer';
import {createErrorElement, createNullElement} from './utils';
import type {LinkRenderOptions, StyleDefaults} from './data_styles';
import type {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLLinkRenderer implements Renderer {
  constructor(private readonly document: Document) {}

  async render(data: Cell): Promise<HTMLElement> {
    if (data.isNull()) {
      return createNullElement(this.document);
    }

    const tag = data.field.tag;
    const linkTag = tag.tag('link');

    if (!linkTag) {
      return createErrorElement(this.document, 'Missing tag for Link renderer');
    }

    if (!data.isString()) {
      return createErrorElement(
        this.document,
        'Invalid type for link renderer.'
      );
    }

    // Read href component from field value or override with field tag if it exists
    const dynamicRef = linkTag.text('field');
    let hrefCell: Cell | undefined;
    if (dynamicRef) {
      hrefCell = data.getRelativeCell(dynamicRef);
    }
    hrefCell ??= data;
    const hrefComponent = String(hrefCell.value);

    // if a URL template is provided, replace the data were '$$$' appears.
    const urlTemplate = linkTag.text('url_template');

    const element = this.document.createElement('a');
    element.href = hrefComponent;
    if (urlTemplate) {
      if (urlTemplate.indexOf('$$') > -1) {
        element.href = urlTemplate.replace('$$', hrefComponent);
      } else {
        element.href = urlTemplate + hrefComponent;
      }
    }
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
    _field: Field,
    _options: LinkRenderOptions
  ): Renderer {
    return new HTMLLinkRenderer(document);
  }

  get rendererName() {
    return 'link';
  }
}
